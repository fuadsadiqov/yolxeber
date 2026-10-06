/**
 * Admin sessiyası — sadə login/parol (.env-dən), uğurlu girişdən sonra imzalı JWT cookie.
 * Edge (middleware) və Node runtime-da işləyir.
 */
import { jwtVerify, SignJWT } from "jose";

export const ADMIN_COOKIE = "yx_admin";
export const ADMIN_SESSION_HOURS = 12;

function secret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("ADMIN_JWT_SECRET təyin olunmayıb");
  return new TextEncoder().encode(s);
}

export async function createAdminToken(username: string) {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(secret());
}

/** Etibarlıdırsa admin adını, deyilsə null qaytarır. */
export async function verifyAdminToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.role === "admin" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
