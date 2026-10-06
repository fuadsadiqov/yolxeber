import { NextResponse } from "next/server";
import { handle, optionalLatLng } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { ReportActionError, reportDetail } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const detail = await reportDetail(id, await getDeviceId(), optionalLatLng(new URL(req.url).searchParams));
  if (!detail) throw new ReportActionError("not_found", 404);
  return NextResponse.json(detail);
});
