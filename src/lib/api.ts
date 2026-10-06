import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DeviceBlockedError } from "@/lib/device";
import { ReportActionError } from "@/lib/reports";
import type { LatLng } from "@/lib/types";

/** Route handler-i bükür: məlum xətaları {error: code} JSON-a çevirir, qalanını loglayır. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ReportActionError) return NextResponse.json({ error: e.code }, { status: e.status });
      if (e instanceof DeviceBlockedError) return NextResponse.json({ error: "device_blocked" }, { status: 403 });
      if (e instanceof z.ZodError) return NextResponse.json({ error: "bad_request" }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  };
}

export const latLngSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** ?lat=&lng= varsa oxuyur, yoxdursa null */
export function optionalLatLng(sp: URLSearchParams): LatLng | null {
  if (!sp.has("lat") || !sp.has("lng")) return null;
  const r = latLngSchema.safeParse({ lat: sp.get("lat"), lng: sp.get("lng") });
  return r.success ? r.data : null;
}

export const uuidSchema = z.string().uuid();
