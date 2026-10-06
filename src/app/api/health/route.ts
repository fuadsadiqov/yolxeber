import { NextResponse } from "next/server";
import { pg } from "@/lib/db";

export const dynamic = "force-dynamic";

// Docker healthcheck və monitorinq üçün.
export async function GET() {
  try {
    const [r] = await pg`SELECT postgis_version() AS postgis`;
    return NextResponse.json({ ok: true, postgis: r.postgis });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
