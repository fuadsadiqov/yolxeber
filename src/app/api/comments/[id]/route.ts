import { NextResponse } from "next/server";
import { handle, uuidSchema } from "@/lib/api";
import { deleteOwnComment } from "@/lib/comments";
import { getDeviceId } from "@/lib/device";

/** DELETE /api/comments/:id — yalnız öz rəyini */
export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await params).id);
  await deleteOwnComment(id, await getDeviceId());
  return NextResponse.json({ ok: true });
});
