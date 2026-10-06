import { NextResponse } from "next/server";
import { handle, uuidSchema } from "@/lib/api";
import { deleteZone, updateZone, zoneInput } from "@/lib/alerts";
import { getDeviceId, requireActiveDevice } from "@/lib/device";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const id = uuidSchema.parse((await params).id);
  const zone = await updateZone(await requireActiveDevice(), id, zoneInput.parse(await req.json()));
  if (!zone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(zone);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const id = uuidSchema.parse((await params).id);
  const ok = await deleteZone(await getDeviceId(), id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
});
