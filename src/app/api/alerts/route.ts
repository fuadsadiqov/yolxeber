import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { createZone, listZones, MAX_ZONES, zoneInput } from "@/lib/alerts";
import { getDeviceId, requireActiveDevice } from "@/lib/device";

export const dynamic = "force-dynamic";

/** GET /api/alerts — bu cihazın xəbərdarlıq zonaları */
export const GET = handle(async () => {
  return NextResponse.json({ items: await listZones(await getDeviceId()), max: MAX_ZONES });
});

/** POST /api/alerts — yeni zona */
export const POST = handle(async (req: Request) => {
  const deviceId = await requireActiveDevice();
  const zone = await createZone(deviceId, zoneInput.parse(await req.json()));
  if (!zone) return NextResponse.json({ error: "too_many_zones" }, { status: 409 });
  return NextResponse.json(zone, { status: 201 });
});
