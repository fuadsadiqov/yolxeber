import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handle, latLngSchema } from "@/lib/api";
import { CATEGORY_KEYS } from "@/lib/categories";
import { requireActiveDevice } from "@/lib/device";
import {
  MAX_FILES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  processImage,
  processVideo,
  type ProcessedMedia,
} from "@/lib/media-server";
import { notifyAllForReport } from "@/lib/push";
import { assertUnderRateLimit, createReport } from "@/lib/report-create";
import { ReportActionError, reportsInBbox } from "@/lib/reports";

export const dynamic = "force-dynamic";

const bboxSchema = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .pipe(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)]));

/** GET /api/reports?bbox=west,south,east,north — xəritənin görünən ərazisi */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const [west, south, east, north] = bboxSchema.parse(sp.get("bbox"));
  const items = await reportsInBbox({ west, south, east, north });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=10" } });
});

const createSchema = latLngSchema.extend({
  category: z.enum(CATEGORY_KEYS),
  note: z.string().trim().max(280).default(""),
  // İstifadəçinin əl ilə yazdığı ünvan (istəyə bağlı); boşdursa koordinatdan təyin olunur
  address: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v.replace(/\s+/g, " ") || undefined)
    .optional(),
});

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

/** POST /api/reports (multipart/form-data): category, note, lat, lng, address?, media[] */
export const POST = handle(async (req: Request) => {
  const deviceId = await requireActiveDevice();
  await assertUnderRateLimit(deviceId);

  const form = await req.formData();
  const fields = createSchema.parse({
    category: form.get("category"),
    note: form.get("note") ?? "",
    lat: form.get("lat"),
    lng: form.get("lng"),
    address: form.get("address") ?? undefined,
  });

  const files = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new ReportActionError("media_required");
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

  const id = await createReport({ deviceId, ...fields, media });
  // Push göndərişi cavabı gecikdirməsin — cavab getdikdən sonra icra olunur.
  after(() => notifyAllForReport(id).catch((e) => console.error("push xətası", e)));
  return NextResponse.json({ id }, { status: 201 });
});
