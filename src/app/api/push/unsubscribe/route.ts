import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { pg as sql } from "@/lib/db";
import { getDeviceId } from "@/lib/device";

const body = z.object({ endpoint: z.string().url().max(1000) });

export const POST = handle(async (req: Request) => {
  const deviceId = await getDeviceId();
  const { endpoint } = body.parse(await req.json());
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND device_id = ${deviceId}::uuid`;
  return NextResponse.json({ ok: true });
});
