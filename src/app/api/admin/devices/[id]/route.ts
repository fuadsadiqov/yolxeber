import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, uuidSchema } from "@/lib/api";
import { blockDevice, requireAdmin, unblockDevice } from "@/lib/admin";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block"), reason: z.string().trim().max(200).optional(), hideReports: z.boolean().default(true) }),
  z.object({ action: z.literal("unblock") }),
]);

/** POST /api/admin/devices/:id {action: "block", reason?, hideReports?} | {action: "unblock"} */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const id = uuidSchema.parse((await params).id);
  const b = body.parse(await req.json());
  const ok =
    b.action === "block" ? await blockDevice(admin, id, b.reason || null, b.hideReports) : await unblockDevice(admin, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
});
