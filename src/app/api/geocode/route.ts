import { NextResponse } from "next/server";
import { handle, latLngSchema } from "@/lib/api";
import { reverseGeocode } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/** GET /api/geocode?lat=&lng= — Nominatim proksi (User-Agent, 1 sorğu/san limiti, DB keşi) */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { lat, lng } = latLngSchema.parse({ lat: sp.get("lat"), lng: sp.get("lng") });
  return NextResponse.json(await reverseGeocode(lat, lng), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
});
