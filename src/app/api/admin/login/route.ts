import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS, createAdminToken } from "@/lib/admin-session";

const body = z.object({ username: z.string().max(100), password: z.string().max(200) });

// Kobud güc hücumlarına qarşı sadə yaddaş-daxili limit: IP başına 10 dəqiqədə 10 cəhd.
// (Tək konteyner üçün kifayətdir; bir neçə instans olsa, Redis/DB-yə köçürülməlidir.)
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.resetAt > now && a.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { username, password } = parsed.data;
  // Hər iki müqayisə həmişə icra olunur ki, cavab vaxtından ad düzgünlüyü bilinməsin.
  const userOk = safeEqual(username, env.ADMIN_USERNAME);
  const passOk = safeEqual(password, env.ADMIN_PASSWORD);
  if (!(userOk && passOk)) {
    const cur = a && a.resetAt > now ? a : { count: 0, resetAt: now + WINDOW_MS };
    cur.count++;
    attempts.set(ip, cur);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createAdminToken(username), {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: ADMIN_SESSION_HOURS * 3600,
  });
  return res;
}
