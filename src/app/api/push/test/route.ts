import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { sendTestPush } from "@/lib/push";

export const dynamic = "force-dynamic";

/** POST /api/push/test — bu cihaza test bildirişi (diaqnostika) */
export const POST = handle(async () => {
  const r = await sendTestPush(await getDeviceId());
  if (!r.configured) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  return NextResponse.json(r);
});
