/// <reference lib="webworker" />
/**
 * Service worker (Serwist). Build zamanı public/sw.js-ə kompilyasiya olunur.
 * - Tətbiq qabığı və statik fayllar precache olunur → zəif internetdə əsas ekranlar açılır.
 * - API: əvvəl şəbəkə, alınmasa keş (son baxılan bildirişlər oflayn görünür).
 * - Xəritə plitələri və şəkillər: əvvəl keş.
 * - Web push: bildiriş göstərmə və kliklə bildirişi açma.
 */
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheableResponsePlugin, CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Xəritə plitələri (cross-origin, "opaque" cavablar da keşlənir)
      matcher: ({ url }) => /(^|\.)basemaps\.cartocdn\.com$|(^|\.)tile\.openstreetmap\.org$/.test(url.hostname),
      handler: new CacheFirst({
        cacheName: "map-tiles",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 800, maxAgeSeconds: 14 * DAY, purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      // Bildiriş şəkilləri (fayl adları unikaldır → dəyişmir). Videolar Range sorğusu ilə gəldiyi üçün keşlənmir.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/media/") && url.pathname.endsWith(".webp"),
      handler: new CacheFirst({
        cacheName: "media",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/geocode",
      handler: new StaleWhileRevalidate({
        cacheName: "geocode",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY })],
      }),
    },
    {
      // Oxu API-ləri: lent, xəritə, yaxınlıqdakılar, detal
      matcher: ({ url, sameOrigin, request }) =>
        sameOrigin &&
        request.method === "GET" &&
        (url.pathname === "/api/feed" || url.pathname.startsWith("/api/reports")),
      handler: new NetworkFirst({
        cacheName: "api",
        networkTimeoutSeconds: 6,
        plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 3 * DAY })],
      }),
    },
    {
      // Admin və digər API-lər heç vaxt keşlənmir
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

type PushPayload = { title: string; body: string; url: string; tag?: string };

self.addEventListener("push", (event) => {
  let data: PushPayload;
  try {
    data = event.data?.json() as PushPayload;
  } catch {
    data = { title: "YolXəbər", body: event.data?.text() ?? "Yeni bildiriş", url: "/" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "az",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data?.url as string) ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Açıq pəncərə varsa onu istifadə edirik
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await (c as WindowClient).navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
