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
 * Yeni bildirişi bildirişləri aktiv etmiş bütün cihazlara göndərir — məsafədən asılı olmayaraq.
 * İstisnalar: bildirişin müəllifi (öz bildirişi haqqında xəbər almır) və bloklanmış cihazlar.
 * (Ərazi/zona filtri hazırda istifadə olunmur — alert_zones cədvəli gələcək üçün qalır.)
 */
export async function notifyAllForReport(reportId: string) {
  if (!pushConfigured()) return;

  const targets = await sql<
    {
      sub_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      category: CategoryKey;
      note: string;
      address: string | null;
      locality: string | null;
    }[]
  >`
    SELECT s.id AS sub_id, s.endpoint, s.p256dh, s.auth, r.category, r.note, r.address, r.locality
    FROM reports r
    JOIN push_subscriptions s ON s.device_id <> r.device_id
    JOIN devices d ON d.id = s.device_id AND d.blocked_at IS NULL
    WHERE r.id = ${reportId}::uuid AND r.status IN ('active', 'verified')`;
  if (!targets.length) return;

  const t0 = targets[0];
  const payload: PushPayload = {
    title: CATEGORIES[t0.category].name,
    body: [reportTitle(t0.note, t0.category), [t0.address, t0.locality].filter(Boolean).join(", ")].filter(Boolean).join(" — "),
    url: `/bildiris/${reportId}`,
    tag: reportId,
  };

  // Push xidmətlərini birdən yükləməmək üçün 50-lik dəstələrlə
  for (let i = 0; i < targets.length; i += 50) {
    await Promise.allSettled(
      targets.slice(i, i + 50).map((t) => sendPush({ id: t.sub_id, endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth }, payload)),
    );
  }
}

/** Diaqnostika: bu cihazın bütün abunəliklərinə test bildirişi göndərir */
export async function sendTestPush(deviceId: string) {
  if (!pushConfigured()) return { configured: false, total: 0, sent: 0 };
  const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = ${deviceId}::uuid`;
  const results = await Promise.all(
    subs.map((s) =>
      sendPush(s, { title: "YolXəbər", body: "Test bildirişi — bildirişlər bu cihazda işləyir ✓", url: "/xeberdarliqlar", tag: "test" }),
    ),
  );
  return { configured: true, total: subs.length, sent: results.filter(Boolean).length };
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
