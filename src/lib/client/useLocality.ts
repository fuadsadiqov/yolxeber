"use client";

import { useEffect, useState } from "react";
import { api, qs } from "@/lib/client/api";
import type { LatLng } from "@/lib/types";

/** Nöqtənin rayon/şəhər adı ("Nərimanov r., Bakı") — panel başlıqları üçün. ~1 km dəqiqliklə. */
export function useLocality(p: LatLng | null) {
  const [locality, setLocality] = useState<string | null>(null);
  const key = p ? `${p.lat.toFixed(2)},${p.lng.toFixed(2)}` : null;
  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(",");
    let alive = true;
    api<{ address: string | null; locality: string | null }>(`/api/geocode?${qs({ lat, lng })}`)
      .then((r) => alive && setLocality(r.locality))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return locality;
}
