import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { pg as sql } from "@/lib/db";
import { requireActiveDevice } from "@/lib/device";

const body = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** POST /api/push/subscribe — brauzerin PushSubscription.toJSON() nəticəsi */
export const POST = handle(async (req: Request) => {
  const deviceId = await requireActiveDevice();
  const s = body.parse(await req.json());
  // Eyni endpoint başqa cihaz id-si ilə gəlibsə (cookie silinib), sahibini yeniləyirik.
  await sql`
    INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth)
    VALUES (${deviceId}::uuid, ${s.endpoint}, ${s.keys.p256dh}, ${s.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET device_id = EXCLUDED.device_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, failure_count = 0`;
  return NextResponse.json({ ok: true });
});
