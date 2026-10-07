import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, optionalLatLng, uuidSchema } from "@/lib/api";
import { getDeviceId, requireActiveDevice } from "@/lib/device";
import { processUploads } from "@/lib/media-server";
import { parseReportFields } from "@/lib/report-fields";
import { assertOwner, updateReport } from "@/lib/report-update";
import { ReportActionError, reportDetail } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const detail = await reportDetail(id, await getDeviceId(), optionalLatLng(new URL(req.url).searchParams));
  if (!detail) throw new ReportActionError("not_found", 404);
  return NextResponse.json(detail);
});

/**
 * PATCH /api/reports/:id (multipart) — müəllif öz bildirişini redaktə edir.
 * Sahələr yaratma ilə eynidir + keep[] (saxlanılan mövcud media id-ləri, sıra ilə) + media[] (yeni fayllar).
 */
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await params).id);
  const deviceId = await requireActiveDevice();
  await assertOwner(id, deviceId);
  const form = await req.formData();
  const fields = parseReportFields(form);
  const keepIds = z.array(uuidSchema).max(4).parse(form.getAll("keep"));
  const files = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  const media = await processUploads(files);
  const r = await updateReport({ reportId: id, deviceId, ...fields, keepIds, media });
  return NextResponse.json({ id, ...r });
});
