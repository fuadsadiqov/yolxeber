/**
 * Cihaz identifikatoru — istifadəçi hesabı olmadığı üçün səs/şikayət/rate-limit buna bağlıdır.
 * Cookie dəyəri: "<uuid>.<HMAC-SHA256 imzası>". İmza sayəsində kimsə başqa cihazın id-sini
 * (məs. müəllifin id-sini) özü yazıb istifadə edə bilməz.
 * Web Crypto istifadə olunur ki, həm middleware (edge), həm də Node runtime-da işləsin.
 */
export const DEVICE_COOKIE = "yx_did";
/** Middleware yoxlanılmış id-ni route handler-lərə bu başlıqla ötürür. */
export const DEVICE_HEADER = "x-yx-device";
export const DEVICE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 il

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key() {
  const secret = process.env.DEVICE_SECRET;
  if (!secret) throw new Error("DEVICE_SECRET təyin olunmayıb");
  keyPromise ??= crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  return keyPromise;
}

function b64url(buf: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function signDeviceId(id: string) {
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(id));
  return `${id}.${b64url(sig)}`;
}

/** Etibarlı token-dirsə id-ni, deyilsə null qaytarır. */
export async function verifyDeviceToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !UUID_RE.test(id)) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(id));
    return ok ? id : null;
  } catch {
    return null;
  }
}
