"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/types";

/** Yer məlumatı yoxdursa xəritə Bakı mərkəzində açılır. */
export const BAKU: LatLng = { lat: 40.4093, lng: 49.8671 };

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";
export type GeoFix = LatLng & { accuracy: number; at: number };

type GeoCtx = {
  position: GeoFix | null;
  status: GeoStatus;
  /** GPS-dən yeni mövqe istəyir (lazım olsa icazə pəncərəsi açılır) */
  locate: () => Promise<GeoFix | null>;
};

const Ctx = createContext<GeoCtx | null>(null);
const LAST_KEY = "yx-last-pos";

export function GeoProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState<GeoFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const inflight = useRef<Promise<GeoFix | null> | null>(null);

  const locate = useCallback(() => {
    if (inflight.current) return inflight.current;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }
    setStatus("locating");
    inflight.current = new Promise<GeoFix | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
          setPosition(fix);
          setStatus("granted");
          try {
            localStorage.setItem(LAST_KEY, JSON.stringify(fix));
          } catch {}
          resolve(fix);
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    }).finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, []);

  useEffect(() => {
    // Son məlum mövqe — xəritə dərhal düzgün yerdə açılsın (GPS cavabını gözləmədən).
    try {
      const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as GeoFix | null;
      if (last && Date.now() - last.at < 6 * 3600_000) setPosition(last);
    } catch {}
    // İcazə artıq verilibsə, avtomatik yeniləyirik; verilməyibsə, istifadəçi düyməyə basana qədər soruşmuruq.
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") locate();
        else if (p.state === "denied") setStatus("denied");
      })
      .catch(() => {});
  }, [locate]);

  const value = useMemo(() => ({ position, status, locate }), [position, status, locate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGeo() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGeo GeoProvider daxilində istifadə olunmalıdır");
  return v;
}

/** İki nöqtə arası məsafə (metr, haversine) — müştəri tərəfində təxmini hesablama üçün */
export function distanceM(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
