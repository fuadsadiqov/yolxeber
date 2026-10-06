import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, latLngSchema } from "@/lib/api";
import { nearbySummary } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/nearby?lat=&lng=&r=3000 — "Yaxınlıqdakı son dəyişikliklər" */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { lat, lng } = latLngSchema.parse({ lat: sp.get("lat"), lng: sp.get("lng") });
  const r = z.coerce.number().int().min(500).max(20000).catch(3000).parse(sp.get("r") ?? undefined);
  return NextResponse.json(await nearbySummary({ lat, lng }, r));
});
