import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { ReportActionError } from "@/lib/reports";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;
export const MAX_FILES = 4;

export type ProcessedMedia = {
  kind: "image" | "video";
  ext: "webp" | "mp4" | "webm";
  data: Buffer;
  thumb: Buffer | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

/**
 * Şəkli yenidən kodlayır. Brauzer artıq sıxışdırıb, amma serverdə də təkrarlayırıq:
 * - EXIF/GPS/XMP metadata tam silinir (sharp default olaraq metadata köçürmür),
 * - oriyentasiya piksellərə tətbiq olunur (rotate),
 * - maksimum 1600px, WebP.
 */
export async function processImage(input: Buffer): Promise<ProcessedMedia> {
  try {
    const img = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const { data, info } = await img
      .clone()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await img.clone().resize({ width: 480, height: 480, fit: "inside" }).webp({ quality: 70 }).toBuffer();
    return { kind: "image", ext: "webp", data, thumb, width: info.width, height: info.height, durationMs: null };
  } catch {
    throw new ReportActionError("media_invalid");
  }
}

/**
 * Videonu təmizləyir: bütün metadata (GPS daxil) silinir, yenidən kodlaşdırılmadan (-c copy) köçürülür.
 * ffmpeg yoxdursa video qəbul edilmir — metadata-sı silinməmiş fayl saxlamırıq.
 */
export async function processVideo(input: Buffer, mime: string): Promise<ProcessedMedia> {
  const dir = await mkdtemp(join(tmpdir(), "yx-"));
  const isWebm = mime === "video/webm";
  const ext = isWebm ? "webm" : "mp4";
  const src = join(dir, "in");
  const out = join(dir, `out.${ext}`);
  const thumbPath = join(dir, "thumb.jpg");
  try {
    await writeFile(src, input);

    let probe: { stdout: string };
    try {
      probe = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", src]);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new ReportActionError("video_unsupported", 503);
      throw new ReportActionError("media_invalid");
    }
    const info = JSON.parse(probe.stdout) as {
      format?: { duration?: string };
      streams?: { codec_type: string; width?: number; height?: number }[];
    };
    const v = info.streams?.find((s) => s.codec_type === "video");
    if (!v) throw new ReportActionError("media_invalid");
    const duration = Number(info.format?.duration ?? 0);
    // Telefonlar 30 saniyəlik videonu bəzən 30.0x kimi yazır — kiçik tolerans
    if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS + 0.5) throw new ReportActionError("video_too_long");

    await run(FFMPEG, [
      "-v", "error", "-y", "-i", src,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-map_metadata", "-1", "-map_chapters", "-1",
      "-c", "copy",
      ...(isWebm ? [] : ["-movflags", "+faststart"]),
      out,
    ]);
    // Önizləmə kadrı
    await run(FFMPEG, ["-v", "error", "-y", "-ss", "0.5", "-i", out, "-frames:v", "1", "-vf", "scale=480:-2", thumbPath]).catch(
      () => run(FFMPEG, ["-v", "error", "-y", "-i", out, "-frames:v", "1", "-vf", "scale=480:-2", thumbPath]),
    );
    const thumb = await sharp(await readFile(thumbPath)).webp({ quality: 70 }).toBuffer().catch(() => null);

    return {
      kind: "video",
      ext,
      data: await readFile(out),
      thumb,
      width: v.width ?? null,
      height: v.height ?? null,
      durationMs: Math.round(duration * 1000),
    };
  } catch (e) {
    if (e instanceof ReportActionError) throw e;
    throw new ReportActionError("media_invalid");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

/** Formdan gələn faylları yoxlayıb emal edir (yaratma və redaktə üçün ortaq). */
export async function processUploads(files: File[]): Promise<ProcessedMedia[]> {
  if (files.length > MAX_FILES) throw new ReportActionError("too_many_files");
  if (files.filter((f) => f.type.startsWith("video/")).length > 1) throw new ReportActionError("too_many_files");
  // Ardıcıl emal — eyni anda bir neçə böyük faylın yaddaşı doldurmasının qarşısını alır.
  const media: ProcessedMedia[] = [];
  for (const f of files) {
    if (f.type.startsWith("video/")) {
      if (!VIDEO_TYPES.has(f.type)) throw new ReportActionError("media_invalid");
      if (f.size > MAX_VIDEO_BYTES) throw new ReportActionError("video_too_large", 413);
      media.push(await processVideo(Buffer.from(await f.arrayBuffer()), f.type));
    } else {
      if (f.size > MAX_IMAGE_BYTES) throw new ReportActionError("media_invalid", 413);
      media.push(await processImage(Buffer.from(await f.arrayBuffer())));
    }
  }
  return media;
}
