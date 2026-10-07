import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Service worker yalnız production build-də yaradılır (dev-də keş qarışıqlıq yaratmasın).
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Oflayn səhifə əvvəlcədən keşlənir — şəbəkə olmayanda göstərilir
  additionalPrecacheEntries: [{ url: "/offline", revision: randomUUID() }],
  reloadOnOnline: false,
});

const nextConfig: NextConfig = {
  // Tətbiqin versiyası (package.json) — UI-da və /api/health-də göstərilir
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  // Docker image üçün minimal server paketi (.next/standalone). Yalnız Dockerfile-da aktivdir:
  // Windows-da pnpm symlink-ləri standalone kopyalamanı EPERM ilə pozur.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  // İzləmə kökü layihə qovluğudur (ev qovluğundakı başqa lockfile-lar səbəbindən səhv kök seçilməsin).
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  // sharp native moduldur — server bundle-a daxil edilmir
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Kamera və GPS yalnız öz saytımızda
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(self)" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
