import "server-only";
import webpush from "web-push";
import { pg as sql } from "@/lib/db";
import { env } from "@/lib/env";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { reportTitle } from "@/lib/format";

let configured = false;
export function pushConfigured() {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/**
 * Yeni bildirişə uyğun gələn xəbərdarlıq zonalarının sahiblərinə push göndərir.
 * Zona uyğunluğu: mərkəzdən radius daxilində + kateqoriya seçilib + müəllifin öz zonası deyil.
 * ST_DWithin(..., 20000) GIST indeksindən istifadə edir, ikinci şərt zonanın öz radiusunu yoxlayır.
 */
export async function notifyZonesForReport(reportId: string) {
  if (!pushConfigured()) return;

  const targets = await sql<
    {
      sub_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      zone_name: string;
      category: CategoryKey;
      note: string;
      address: string | null;
    }[]
  >`
    SELECT DISTINCT ON (s.id) s.id AS sub_id, s.endpoint, s.p256dh, s.auth, z.name AS zone_name,
           r.category, r.note, r.address
    FROM reports r
    JOIN alert_zones z
      ON z.enabled
     AND ST_DWithin(z.center, r.location, 20000)
     AND ST_DWithin(z.center, r.location, z.radius_m)
     AND r.category = ANY (z.categories)
     AND z.device_id <> r.device_id
    JOIN push_subscriptions s ON s.device_id = z.device_id
    WHERE r.id = ${reportId}::uuid AND r.status IN ('active', 'verified')
    ORDER BY s.id, z.created_at`;

  await Promise.allSettled(
    targets.map((t) =>
      sendPush(
        { id: t.sub_id, endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth },
        {
          title: `${CATEGORIES[t.category].name} · ${t.zone_name}`,
          body: [reportTitle(t.note, t.category), t.address].filter(Boolean).join(" — "),
          url: `/bildiris/${reportId}`,
          tag: reportId,
        },
      ),
    ),
  );
}

export async function sendPush(sub: { id: string; endpoint: string; p256dh: string; auth: string }, payload: PushPayload) {
  if (!pushConfigured()) return false;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 6, urgency: "normal" },
    );
    await sql`UPDATE push_subscriptions SET last_success_at = now(), failure_count = 0 WHERE id = ${sub.id}::uuid`;
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404/410 — abunəlik artıq etibarlı deyil (istifadəçi icazəni geri götürüb və s.)
    if (status === 404 || status === 410) {
      await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}::uuid`;
    } else {
      await sql`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = ${sub.id}::uuid`;
    }
    return false;
  }
}
