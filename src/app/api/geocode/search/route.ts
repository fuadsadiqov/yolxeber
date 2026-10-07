import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, optionalLatLng } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { searchAddress } from "@/lib/geocode";

export const dynamic = "force-dynamic";

// Nominatim-ə gedən ümumi növbəni bir cihaz doldurmasın: dəqiqədə 15 axtarış.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<string, { count: number; resetAt: number }>();

/** GET /api/geocode/search?q=...&lat=&lng= — yazılmış ünvandan koordinat (forward geocoding) */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const q = z.string().trim().min(3).max(120).parse(sp.get("q"));

  const device = await getDeviceId();
  const now = Date.now();
  const h = hits.get(device);
  if (h && h.resetAt > now && h.count >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  hits.set(device, h && h.resetAt > now ? { ...h, count: h.count + 1 } : { count: 1, resetAt: now + WINDOW_MS });
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);

  const items = await searchAddress(q, optionalLatLng(sp));
  return NextResponse.json({ items });
});
