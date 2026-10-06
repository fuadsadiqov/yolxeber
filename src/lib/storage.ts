import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { env } from "@/lib/env";

/**
 * Disk storage (Docker volume). Açar formatı: "r/<reportId>/<mediaId>.webp".
 * Bütün yollar MEDIA_DIR daxilində qalmalıdır — "../" ilə qaçışın qarşısı alınır.
 */
const root = resolve(env.MEDIA_DIR ?? "./data/media");

export function storagePath(key: string): string {
  const p = resolve(root, key);
  if (p !== root && !p.startsWith(root + sep)) throw new Error("Yanlış storage açarı");
  return p;
}

export async function saveFile(key: string, data: Buffer | Uint8Array) {
  const p = storagePath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

/** Bildirişin bütün media qovluğunu silir (admin silmə, uğursuz yükləmə) */
export async function deleteReportMedia(reportId: string) {
  await rm(storagePath(`r/${reportId}`), { recursive: true, force: true });
}
