import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireActiveDevice } from "@/lib/device";
import { processUploads } from "@/lib/media-server";
import { notifyAllForReport } from "@/lib/push";
import { assertUnderRateLimit, createReport } from "@/lib/report-create";
import { parseReportFields } from "@/lib/report-fields";
import { ReportActionError, reportsInBbox } from "@/lib/reports";

export const dynamic = "force-dynamic";

const bboxSchema = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .pipe(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)]));

/** GET /api/reports?bbox=west,south,east,north — xəritənin görünən ərazisi */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const [west, south, east, north] = bboxSchema.parse(sp.get("bbox"));
  const items = await reportsInBbox({ west, south, east, north });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=10" } });
});


/** POST /api/reports (multipart/form-data): category, note, lat, lng, address?, media[] */
export const POST = handle(async (req: Request) => {
  const deviceId = await requireActiveDevice();
  await assertUnderRateLimit(deviceId);

  const form = await req.formData();
  const fields = parseReportFields(form);

  const files = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new ReportActionError("media_required");
  const media = await processUploads(files);

  const id = await createReport({ deviceId, ...fields, media });
  // Push göndərişi cavabı gecikdirməsin — cavab getdikdən sonra icra olunur.
  after(() => notifyAllForReport(id).catch((e) => console.error("push xətası", e)));
  return NextResponse.json({ id }, { status: 201 });
});
