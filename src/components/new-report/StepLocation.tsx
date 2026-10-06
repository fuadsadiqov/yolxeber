"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { MapHandle, MapView } from "@/components/map/MapCanvas";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, qs } from "@/lib/client/api";
import { BAKU, distanceM, useGeo } from "@/lib/client/geo";
import type { LatLng } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

export type PickedPlace = LatLng & { address: string | null; locality: string | null; source: "gps" | "map"; accuracy: number | null };

/**
 * Addım 2 (dizayn 04): pin ekranın mərkəzində sabitdir, istifadəçi xəritəni altında sürüşdürür.
 * GPS-dən gələn mövqedən uzaqlaşdıqda mənbə "xəritədən" olur.
 */
export function StepLocation({ place, setPlace }: { place: PickedPlace | null; setPlace: (p: PickedPlace) => void }) {
  const { position, status, locate } = useGeo();
  const toast = useToast();
  const mapRef = useRef<MapHandle>(null);
  const [initial] = useState<LatLng>(() => place ?? position ?? BAKU);
  const [geocoding, setGeocoding] = useState(false);
  const centered = useRef(!!place);
  const geoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastKey = useRef("");

  // Addıma ilk girişdə GPS-dən təzə mövqe istəyirik
  useEffect(() => {
    if (place) return;
    locate().then((fix) => {
      if (!fix)
        toast("Yer məlumatına icazə verilməyib — yeri xəritədə özünüz seçin", {
          icon: "locate",
          action: { label: "İcazə ver", onClick: () => void locate() },
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (position && !centered.current) {
      centered.current = true;
      mapRef.current?.flyTo(position, 17);
    }
  }, [position]);

  function onView(v: MapView) {
    const c = v.center;
    const fromGps = !!position && distanceM(c, position) <= Math.max(25, position.accuracy);
    const key = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setPlace({
      ...c,
      address: place?.address ?? null,
      locality: place?.locality ?? null,
      source: fromGps ? "gps" : "map",
      accuracy: fromGps ? position!.accuracy : null,
    });
    // Ünvan sorğusu — sürüşdürmə dayandıqdan sonra (Nominatim limitinə hörmət)
    clearTimeout(geoTimer.current);
    setGeocoding(true);
    geoTimer.current = setTimeout(async () => {
      try {
        const g = await api<{ address: string | null; locality: string | null }>(`/api/geocode?${qs({ lat: c.lat.toFixed(6), lng: c.lng.toFixed(6) })}`);
        if (lastKey.current === key)
          setPlace({ ...c, ...g, source: fromGps ? "gps" : "map", accuracy: fromGps ? position!.accuracy : null });
      } catch {
        /* ünvan tapılmasa da koordinat kifayətdir */
      } finally {
        if (lastKey.current === key) setGeocoding(false);
      }
    }, 600);
  }

  async function toMyLocation() {
    const fix = await locate();
    if (fix) mapRef.current?.flyTo(fix, 17);
    else toast("Yer məlumatına icazə verilməyib", { icon: "locate" });
  }

  return (
    <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: "calc(env(safe-area-inset-top) + 136px)" }}>
      <MapCanvas ref={mapRef} center={initial} zoom={place || position ? 17 : 13} onViewChange={onView} />

      <div className="pointer-events-none absolute left-1/2 top-3.5 z-[600] flex h-9 -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-[#16211C] px-3.5 text-[13px] font-semibold text-white">
        Dəqiqləşdirmək üçün xəritəni sürüşdürün
      </div>

      {/* Sabit mərkəz pini — xəritə konteynerinin dəqiq mərkəzində (seçilən koordinat = pinin ucu) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[600]">
        <div className="absolute -ml-[60px] -mt-[60px] h-[120px] w-[120px] rounded-full border-[1.5px] border-[rgba(0,168,107,.4)] bg-[rgba(0,168,107,.12)]" />
        <div className="absolute -ml-2.5 -mt-[3px] h-[7px] w-5 rounded-full bg-[rgba(22,33,28,.35)]" />
        <div className="absolute -ml-6 -mt-[62px] flex h-12 w-12 items-center justify-center">
          <div className="flex h-11 w-11 -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] border-[3px] border-white bg-primary shadow-[0_6px_14px_rgba(22,33,28,.4)]">
            <div className="h-3 w-3 rounded-full bg-accent" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={toMyLocation}
        className="absolute right-4 z-[600] flex h-[52px] items-center gap-2 rounded-full bg-surface pl-3.5 pr-[18px] text-[15px] font-bold text-primary-ink shadow-float dark:border dark:border-line"
        style={{ bottom: 250 }}
      >
        <span className="h-[22px] w-[22px]">
          <Icon name="locate" />
        </span>
        {status === "locating" ? "Axtarılır…" : "Mənim yerim"}
      </button>

      <div
        className="absolute inset-x-0 bottom-0 z-[650] rounded-t-3xl bg-surface px-4 pt-5 shadow-sheet dark:border-t dark:border-line"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 104px)" }}
      >
        <div className="mx-auto max-w-[480px]">
          <div className="mb-2 text-xs font-semibold tracking-[.06em] text-muted">
            ÜNVAN · {place?.source === "gps" ? "AVTOMATİK" : "XƏRİTƏDƏN"}
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
              <span className="h-[22px] w-[22px]">
                <Icon name="pin" />
              </span>
            </span>
            <div className="min-w-0" aria-live="polite">
              <div className="truncate text-[17px] font-bold">
                {place?.address ?? (geocoding ? "Ünvan müəyyənləşdirilir…" : place ? "Ünvan tapılmadı" : "Yer seçilməyib")}
              </div>
              <div className="mt-0.5 truncate text-sm text-muted">
                {place?.locality ?? (place ? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : "")}
              </div>
              {place?.source === "gps" && place.accuracy != null && place.accuracy > 150 ? (
                // Zəif dəqiqlik (məs. Wi-Fi/IP üzrə yer) — istifadəçi pini özü dəqiqləşdirməlidir
                <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-accent-badge-fg">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Təxmini yer (±{place.accuracy >= 1000 ? `${Math.round(place.accuracy / 1000)} km` : `${Math.round(place.accuracy)} m`}) — xəritədə dəqiqləşdirin
                </div>
              ) : place?.source === "gps" && place.accuracy != null ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-success">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  GPS · ±{Math.round(place.accuracy)} m dəqiqlik
                </div>
              ) : place ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                  <span className="h-2 w-2 rounded-full bg-subtle" />
                  Xəritədə seçildi
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
