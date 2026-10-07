import { NextResponse } from "next/server";
import { handle, uuidSchema } from "@/lib/api";
import { flagComment } from "@/lib/comments";
import { requireActiveDevice } from "@/lib/device";

/** POST /api/comments/:id/flag — şikayət (3 şikayətdə avtomatik gizlədilir) */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await params).id);
  await flagComment(id, await requireActiveDevice());
  return NextResponse.json({ ok: true });
});
