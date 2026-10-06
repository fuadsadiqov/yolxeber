import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** VAPID ictimai açarı — brauzer push abunəliyi üçün */
export function GET() {
  if (!env.VAPID_PUBLIC_KEY) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  return NextResponse.json({ key: env.VAPID_PUBLIC_KEY });
}
