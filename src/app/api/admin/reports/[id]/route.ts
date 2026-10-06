import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, uuidSchema } from "@/lib/api";
import { deleteReport, requireAdmin, restoreReport } from "@/lib/admin";

const body = z.object({ action: z.enum(["restore", "delete"]) });

/** POST /api/admin/reports/:id {action: "restore" | "delete"} */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const id = uuidSchema.parse((await params).id);
  const { action } = body.parse(await req.json());
  const ok = action === "restore" ? await restoreReport(admin, id) : await deleteReport(admin, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
});
