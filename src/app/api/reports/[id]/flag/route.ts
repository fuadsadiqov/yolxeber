import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, uuidSchema } from "@/lib/api";
import { requireActiveDevice } from "@/lib/device";
import { flagReport } from "@/lib/reports";

const body = z.object({
  reason: z.enum(["wrong", "spam", "offensive", "privacy", "other"]),
  comment: z.string().trim().max(280).optional(),
});

/** POST /api/reports/:id/flag {reason, comment?} */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await params).id);
  const { reason, comment } = body.parse(await req.json());
  const deviceId = await requireActiveDevice();
  await flagReport(id, deviceId, reason, comment || null);
  return NextResponse.json({ ok: true });
});
