"use client";

export const MAX_FILES = 4;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;
const MAX_SIDE = 1600;

export type DraftMedia = {
  id: string;
  kind: "image" | "video";
  blob: Blob;
  /** Önizləmə üçün object URL (silinəndə revoke olunur) */
  url: string;
  fileName: string;
  capturedAt: Date;
  durationS?: number;
};

export class MediaError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close?: () => void }> {
  try {
    // imageOrientation: EXIF oriyentasiyasını piksellərə tətbiq edir (telefon şəkilləri yan çıxmasın)
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  } catch {
    // Köhnə brauzerlər üçün <img> ilə
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { src: img, w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Şəkli yükləmədən əvvəl brauzerdə sıxışdırır: maksimum 1600px, WebP (dəstəklənmirsə JPEG).
 * Canvas-dan yenidən kodlama EXIF metadata-nı (GPS, cihaz modeli) da silir.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new MediaError("Şəkil açılmadı. Başqa şəkil seçin.");
  }
  const { src, w, h, close } = decoded;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new MediaError("Şəkil emal olunmadı.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  close?.();

  // Safari köhnə versiyalarda WebP kodlaya bilmir və PNG qaytarır — onda JPEG istifadə edirik.
  let blob = await toBlob(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new MediaError("Şəkil emal olunmadı.");
  return blob;
}

export function videoDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new MediaError("Video açılmadı."));
    };
    v.src = url;
  });
}

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Seçilmiş faylı yoxlayıb hazırlayır: şəkil → sıxışdırılır, video → ölçü/müddət limiti yoxlanılır. */
export async function prepareMedia(file: File): Promise<DraftMedia> {
  const id = crypto.randomUUID();
  const capturedAt = new Date(file.lastModified || Date.now());
  if (file.type.startsWith("video/")) {
    if (!VIDEO_TYPES.includes(file.type)) throw new MediaError("Bu video formatı dəstəklənmir (MP4, MOV, WebM).");
    if (file.size > MAX_VIDEO_BYTES) throw new MediaError("Video 50 MB-dan böyük olmamalıdır.");
    const d = await videoDuration(file);
    if (Number.isFinite(d) && d > MAX_VIDEO_SECONDS + 0.5) throw new MediaError("Video 30 saniyədən uzun olmamalıdır.");
    return { id, kind: "video", blob: file, url: URL.createObjectURL(file), fileName: file.name || "video.mp4", capturedAt, durationS: d };
  }
  if (!file.type.startsWith("image/") && file.type !== "") throw new MediaError("Yalnız şəkil və ya video seçin.");
  const blob = await compressImage(file);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return { id, kind: "image", blob, url: URL.createObjectURL(blob), fileName: `photo.${ext}`, capturedAt };
}
