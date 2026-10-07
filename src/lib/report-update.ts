import "server-only";
import { randomUUID } from "node:crypto";
import { pg as sql } from "@/lib/db";
import type { CategoryKey } from "@/lib/categories";
import { reverseGeocode } from "@/lib/geocode";
import { MAX_FILES, type ProcessedMedia } from "@/lib/media-server";
import { ReportActionError } from "@/lib/reports";
import { deleteFiles, saveFile } from "@/lib/storage";

/** Bu qədərdən çox yerdəyişmə və ya kateqoriya dəyişikliyi "əsaslı dəyişiklik" sayılır */
const SUBSTANTIVE_MOVE_M = 150;

/** Ucuz yoxlama — faylları emal etməzdən əvvəl: bildiriş mövcuddur və bu cihaz müəllifdir */
export async function assertOwner(reportId: string, deviceId: string) {
  const [r] = await sql<{ device_id: string; status: string }[]>`SELECT device_id, status FROM reports WHERE id = ${reportId}::uuid`;
  if (!r || r.status === "hidden" || r.status === "deleted") throw new ReportActionError("not_found", 404);
  if (r.device_id !== deviceId) throw new ReportActionError("not_owner", 403);
}

/**
 * Müəllifin öz bildirişini redaktə etməsi (eyni 3 addımlı forma).
 * - Yalnız bildirişi yaradan cihaz; gizlədilmiş/silinmiş bildiriş redaktə olunmur.
 * - Kateqoriya dəyişərsə və ya yer 150 m-dən çox sürüşərsə, əvvəlki səslər sıfırlanır —
 *   təsdiqlənmiş bildirişi tamam başqa şeyə çevirib təsdiqləri saxlamaq olmasın.
 * - Media: `keepIds` sırası ilə saxlanılanlar + yeni fayllar (cəmi 1–4, ən çox 1 video).
 */
export async function updateReport(input: {
  reportId: string;
  deviceId: string;
  category: CategoryKey;
  note: string;
  lat: number;
  lng: number;
  address?: string;
  keepIds: string[];
  media: ProcessedMedia[];
}): Promise<{ votesReset: boolean }> {
  const [rep] = await sql<{ device_id: string; status: string; category: CategoryKey; moved_m: number }[]>`
    SELECT device_id, status, category,
           ST_Distance(location, ST_SetSRID(ST_MakePoint(${input.lng}::float8, ${input.lat}::float8), 4326)::geography) AS moved_m
    FROM reports WHERE id = ${input.reportId}::uuid`;
  if (!rep || rep.status === "hidden" || rep.status === "deleted") throw new ReportActionError("not_found", 404);
  if (rep.device_id !== input.deviceId) throw new ReportActionError("not_owner", 403);

  const existing = await sql<{ id: string; kind: "image" | "video"; storage_key: string; thumb_key: string | null }[]>`
    SELECT id, kind, storage_key, thumb_key FROM report_media WHERE report_id = ${input.reportId}::uuid`;
  const keep = input.keepIds.map((id) => existing.find((m) => m.id === id)).filter((m): m is (typeof existing)[number] => !!m);
  const removed = existing.filter((m) => !keep.includes(m));

  const total = keep.length + input.media.length;
  if (total === 0) throw new ReportActionError("media_required");
  if (total > MAX_FILES) throw new ReportActionError("too_many_files");
  if (keep.filter((m) => m.kind === "video").length + input.media.filter((m) => m.kind === "video").length > 1)
    throw new ReportActionError("too_many_files");

  const geo = await reverseGeocode(input.lat, input.lng);
  const address = input.address ?? geo.address;
  const votesReset = rep.category !== input.category || Number(rep.moved_m) > SUBSTANTIVE_MOVE_M;

  // Yeni fayllar əvvəl diskə yazılır; tranzaksiya alınmasa geri silinir
  const added = await Promise.all(
    input.media.map(async (m, i) => {
      const id = randomUUID();
      const key = `r/${input.reportId}/${id}.${m.ext}`;
      const thumbKey = m.thumb ? `r/${input.reportId}/${id}_t.webp` : null;
      await saveFile(key, m.data);
      if (thumbKey && m.thumb) await saveFile(thumbKey, m.thumb);
      return { id, key, thumbKey, m, position: keep.length + i };
    }),
  );

  try {
    await sql.begin(async (tx) => {
      if (votesReset) await tx`DELETE FROM votes WHERE report_id = ${input.reportId}::uuid`;
      // Status trigger tərəfindən sayğaclara görə yenidən hesablanır
      await tx`
        UPDATE reports SET
          category = ${input.category},
          note = ${input.note},
          location = ST_SetSRID(ST_MakePoint(${input.lng}::float8, ${input.lat}::float8), 4326)::geography,
          address = ${address},
          locality = ${geo.locality},
          edited_at = now()
          ${votesReset ? tx`, confirm_count = 0, outdated_count = 0` : tx``}
        WHERE id = ${input.reportId}::uuid`;
      if (removed.length) await tx`DELETE FROM report_media WHERE id IN ${tx(removed.map((m) => m.id))}`;
      for (const [i, m] of keep.entries()) {
        await tx`UPDATE report_media SET position = ${i} WHERE id = ${m.id}::uuid`;
      }
      for (const x of added) {
        await tx`
          INSERT INTO report_media (id, report_id, kind, storage_key, thumb_key, width, height, duration_ms, size_bytes, position)
          VALUES (${x.id}::uuid, ${input.reportId}::uuid, ${x.m.kind}, ${x.key}, ${x.thumbKey}, ${x.m.width}, ${x.m.height},
                  ${x.m.durationMs}, ${x.m.data.length}, ${x.position})`;
      }
    });
  } catch (e) {
    await deleteFiles(added.flatMap((x) => [x.key, x.thumbKey])).catch(() => {});
    throw e;
  }

  // Çıxarılan mediaların faylları — DB yeniləndikdən sonra
  await deleteFiles(removed.flatMap((m) => [m.storage_key, m.thumb_key])).catch(() => {});
  return { votesReset };
}
