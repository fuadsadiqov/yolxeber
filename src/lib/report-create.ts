import "server-only";
import { randomUUID } from "node:crypto";
import { pg as sql } from "@/lib/db";
import type { CategoryKey } from "@/lib/categories";
import { reverseGeocode } from "@/lib/geocode";
import type { ProcessedMedia } from "@/lib/media-server";
import { ReportActionError } from "@/lib/reports";
import { deleteReportMedia, saveFile } from "@/lib/storage";

/** Media emalından əvvəl ucuz yoxlama — limitə çatmış cihaz üçün faylları boş yerə emal etməyək. */
export async function assertUnderRateLimit(deviceId: string) {
  const [r] = await sql<{ n: number; max: number }[]>`
    SELECT (SELECT count(*)::int FROM reports WHERE device_id = ${deviceId}::uuid AND created_at > now() - interval '1 hour') AS n,
           (SELECT reports_per_hour FROM app_settings WHERE id = 1) AS max`;
  if (r.n >= r.max) throw new ReportActionError("rate_limited", 429);
}

export async function createReport(input: {
  deviceId: string;
  category: CategoryKey;
  note: string;
  lat: number;
  lng: number;
  media: ProcessedMedia[];
}): Promise<string> {
  const reportId = randomUUID();
  // Ünvanı serverdə müəyyən edirik (müştəri mətni etibarlı deyil). Addım 2-də eyni nöqtə üçün
  // artıq sorğu edildiyindən adətən keşdən gəlir.
  const geo = await reverseGeocode(input.lat, input.lng);

  // Fayllar əvvəl diskə yazılır, sonra DB tranzaksiyası. Tranzaksiya alınmasa fayllar silinir.
  const rows = await Promise.all(
    input.media.map(async (m, i) => {
      const id = randomUUID();
      const key = `r/${reportId}/${id}.${m.ext}`;
      const thumbKey = m.thumb ? `r/${reportId}/${id}_t.webp` : null;
      await saveFile(key, m.data);
      if (thumbKey && m.thumb) await saveFile(thumbKey, m.thumb);
      return { id, key, thumbKey, m, position: i };
    }),
  );

  try {
    await sql.begin(async (tx) => {
      // Eyni cihazdan paralel sorğular limiti keçməsin deyə cihaz üzrə kilid.
      await tx`SELECT pg_advisory_xact_lock(hashtext(${input.deviceId}))`;
      const [r] = await tx<{ n: number; max: number }[]>`
        SELECT (SELECT count(*)::int FROM reports WHERE device_id = ${input.deviceId}::uuid AND created_at > now() - interval '1 hour') AS n,
               (SELECT reports_per_hour FROM app_settings WHERE id = 1) AS max`;
      if (r.n >= r.max) throw new ReportActionError("rate_limited", 429);

      await tx`
        INSERT INTO reports (id, device_id, category, note, location, address, locality)
        VALUES (${reportId}::uuid, ${input.deviceId}::uuid, ${input.category}, ${input.note},
                ST_SetSRID(ST_MakePoint(${input.lng}::float8, ${input.lat}::float8), 4326)::geography,
                ${geo.address}, ${geo.locality})`;
      for (const x of rows) {
        await tx`
          INSERT INTO report_media (id, report_id, kind, storage_key, thumb_key, width, height, duration_ms, size_bytes, position)
          VALUES (${x.id}::uuid, ${reportId}::uuid, ${x.m.kind}, ${x.key}, ${x.thumbKey}, ${x.m.width}, ${x.m.height},
                  ${x.m.durationMs}, ${x.m.data.length}, ${x.position})`;
      }
    });
  } catch (e) {
    await deleteReportMedia(reportId).catch(() => {});
    throw e;
  }
  return reportId;
}
