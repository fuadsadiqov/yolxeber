import { NextResponse } from "next/server";
import { pg } from "@/lib/db";

export const dynamic = "force-dynamic";

// Docker healthcheck və monitorinq üçün.
export async function GET() {
  try {
    const [r] = await pg`SELECT postgis_version() AS postgis`;
    return NextResponse.json({ ok: true, version: process.env.NEXT_PUBLIC_APP_VERSION, postgis: r.postgis });
  } catch {
    return NextResponse.json({ ok: false, version: process.env.NEXT_PUBLIC_APP_VERSION }, { status: 503 });
  }
}
