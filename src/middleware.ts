import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-session";
import { DEVICE_COOKIE, DEVICE_HEADER, DEVICE_MAX_AGE, signDeviceId, verifyDeviceToken } from "@/lib/device-token";

/**
 * 1) Hər ziyarətçiyə imzalı cihaz cookie-si verir (yoxdursa və ya saxtadırsa yenisini yaradır)
 *    və yoxlanılmış id-ni DEVICE_HEADER ilə route handler-lərə ötürür.
 * 2) /admin və /api/admin yollarını qoruyur (login səhifəsi və endpoint-i istisna).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";
  if (isAdminPage || isAdminApi) {
    const admin = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!admin) {
      if (isAdminApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  let deviceId = await verifyDeviceToken(req.cookies.get(DEVICE_COOKIE)?.value);
  const isNew = !deviceId;
  deviceId ??= crypto.randomUUID();

  // Müştərinin özünün göndərdiyi başlığa heç vaxt etibar etmirik — üzərinə yazırıq.
  const headers = new Headers(req.headers);
  headers.set(DEVICE_HEADER, deviceId);
  const res = NextResponse.next({ request: { headers } });

  if (isNew) {
    res.cookies.set(DEVICE_COOKIE, await signDeviceId(deviceId), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: DEVICE_MAX_AGE,
    });
  }
  return res;
}

export const config = {
  // Statik fayllar, şəkillər və service worker üçün middleware işləmir.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|media/|manifest.webmanifest|sw.js|swe-worker|robots.txt).*)"],
};
