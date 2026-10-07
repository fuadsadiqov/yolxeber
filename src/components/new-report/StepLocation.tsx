"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { MapHandle, MapView } from "@/components/map/MapCanvas";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, qs } from "@/lib/client/api";
import { BAKU, distanceM, useGeo } from "@/lib/client/geo";
import type { LatLng } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

export type PickedPlace = LatLng & {
  address: string | null;
  locality: string | null;
  source: "gps" | "map";
  accuracy: number | null;
  /** İstifadəçi ünvanı əl ilə yazıb — avtomatik ünvan artıq üzərinə yazılmır */
  addressEdited?: boolean;
  /** Son avtomatik (Nominatim) ünvan — "avtomatik ünvana qayıt" üçün */
  autoAddress?: string | null;
};

export const ADDRESS_MAX = 120;

type SearchHit = LatLng & { label: string; address: string | null; locality: string | null };

/**
 * Addım 2 (dizayn 04): pin ekranın mərkəzində sabitdir, istifadəçi xəritəni altında sürüşdürür.
 * GPS-dən gələn mövqedən uzaqlaşdıqda mənbə "xəritədən" olur.
 */
export function StepLocation({
  place,
  setPlace,
}: {
  place: PickedPlace | null;
  setPlace: React.Dispatch<React.SetStateAction<PickedPlace | null>>;
}) {
  const { position, status, locate } = useGeo();
  const toast = useToast();
  const mapRef = useRef<MapHandle>(null);
  const [initial] = useState<LatLng>(() => place ?? position ?? BAKU);
  const [geocoding, setGeocoding] = useState(false);
  const centered = useRef(!!place);
  const geoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastKey = useRef("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);

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
    // Funksional yeniləmə — əl ilə yazılmış ünvan xəritə hərəkətində itməsin
    setPlace((p) => ({
      ...c,
      address: p?.address ?? null,
      locality: p?.locality ?? null,
      addressEdited: p?.addressEdited,
      autoAddress: p?.autoAddress,
      source: fromGps ? "gps" : "map",
      accuracy: fromGps ? position!.accuracy : null,
    }));
    // Ünvan sorğusu — sürüşdürmə dayandıqdan sonra (Nominatim limitinə hörmət)
    clearTimeout(geoTimer.current);
    setGeocoding(true);
    geoTimer.current = setTimeout(async () => {
      try {
        const g = await api<{ address: string | null; locality: string | null }>(`/api/geocode?${qs({ lat: c.lat.toFixed(6), lng: c.lng.toFixed(6) })}`);
        if (lastKey.current === key)
          setPlace((p) => ({
            ...c,
            locality: g.locality,
            autoAddress: g.address,
            // İstifadəçi özü yazıbsa, onun mətnini saxlayırıq
            address: p?.addressEdited ? p.address : g.address,
            addressEdited: p?.addressEdited,
            source: fromGps ? "gps" : "map",
            accuracy: fromGps ? position!.accuracy : null,
          }));
      } catch {
        /* ünvan tapılmasa da koordinat kifayətdir */
      } finally {
        if (lastKey.current === key) setGeocoding(false);
      }
    }, 600);
  }

  /**
   * Yazılmış ünvandan yer tapır (forward geocoding) və pini ora aparır.
   * Nominatim qaydasına görə avtomatik tamamlama yoxdur — yalnız Enter / axtarış düyməsi ilə.
   */
  async function searchTyped() {
    const q = place?.address?.trim() ?? "";
    if (q.length < 3 || searching) return;
    setSearching(true);
    setHits(null);
    try {
      const near = mapRef.current?.getCenter() ?? position ?? BAKU;
      const { items } = await api<{ items: SearchHit[] }>(
        `/api/geocode/search?${qs({ q, lat: near.lat.toFixed(3), lng: near.lng.toFixed(3) })}`,
      );
      if (items.length === 0) toast("Bu ünvan tapılmadı. Pini xəritədə özünüz yerləşdirin.", { icon: "pin" });
      else if (items.length === 1) applyHit(items[0]);
      else setHits(items);
    } catch (e) {
      toast(e instanceof ApiError && e.status === 429 ? "Çox sayda axtarış. Bir dəqiqə sonra yenidən cəhd edin." : "Axtarış alınmadı.");
    } finally {
      setSearching(false);
    }
  }

  function applyHit(h: SearchHit) {
    setHits(null);
    // Mətn seçilən nəticə ilə əvəzlənir; xəritə hərəkətindən sonra əl ilə yazılmış kimi qorunur
    setPlace((p) => (p ? { ...p, address: h.label.slice(0, ADDRESS_MAX), locality: h.locality, addressEdited: true } : p));
    centered.current = true;
    mapRef.current?.flyTo(h, 17);
  }

  async function toMyLocation() {
    const fix = await locate();
    if (fix) mapRef.current?.flyTo(fix, 17);
    else toast("Yer məlumatına icazə verilməyib", { icon: "locate" });
  }

  return (
    // Xəritə panelin üstündə qalan sahəni tutur (panel böyüdükcə kiçilir) — pin və "Mənim yerim" həmişə görünür.
    // Xəritə panelin yuvarlaq künclərinin altına 24px uzanır; pin xəritə konteynerinin mərkəzində olduğu üçün
    // seçilən koordinat dəqiq qalır.
    <div className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden" style={{ top: "calc(env(safe-area-inset-top) + 8.5rem)" }}>
      <div className="relative -mb-6 min-h-[12.5rem] flex-1 overflow-hidden">
      <MapCanvas ref={mapRef} center={initial} zoom={place || position ? 17 : 13} onViewChange={onView} />

      <div className="pointer-events-none absolute left-1/2 top-3.5 z-[600] flex h-9 -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-[#16211C] px-3.5 text-[0.8125rem] font-semibold text-white">
        Dəqiqləşdirmək üçün xəritəni sürüşdürün
      </div>

      {/* Sabit mərkəz pini — xəritə konteynerinin dəqiq mərkəzində (seçilən koordinat = pinin ucu) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[600]">
        <div className="absolute -ml-[3.75rem] -mt-[3.75rem] h-[7.5rem] w-[7.5rem] rounded-full border-[0.0938rem] border-[rgba(0,168,107,.4)] bg-[rgba(0,168,107,.12)]" />
        <div className="absolute -ml-2.5 -mt-[0.1875rem] h-[0.4375rem] w-5 rounded-full bg-[rgba(22,33,28,.35)]" />
        <div className="absolute -ml-6 -mt-[3.875rem] flex h-12 w-12 items-center justify-center">
          <div className="flex h-11 w-11 -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] border-[0.1875rem] border-white bg-primary shadow-[0_6px_14px_rgba(22,33,28,.4)]">
            <div className="h-3 w-3 rounded-full bg-accent" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={toMyLocation}
        className="absolute bottom-9 right-4 z-[600] flex h-[3.25rem] items-center gap-2 rounded-full bg-surface pl-3.5 pr-[1.125rem] text-[0.9375rem] font-bold text-primary-ink shadow-float dark:border dark:border-line"
      >
        <span className="h-[1.375rem] w-[1.375rem]">
          <Icon name="locate" />
        </span>
        {status === "locating" ? "Axtarılır…" : "Mənim yerim"}
      </button>
      </div>

      <div
        className="relative z-[650] flex-none rounded-t-3xl bg-surface px-4 pt-5 shadow-sheet dark:border-t dark:border-line"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}
      >
        <div className="mx-auto max-w-[30rem]">
          <div className="mb-2 text-xs font-semibold tracking-[.06em] text-muted">
            ÜNVAN · {place?.addressEdited ? "ƏL İLƏ" : place?.source === "gps" ? "AVTOMATİK" : "XƏRİTƏDƏN"}
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
              <span className="h-[1.375rem] w-[1.375rem]">
                <Icon name="pin" />
              </span>
            </span>
            <div className="min-w-0 flex-1" aria-live="polite">
              <label htmlFor="address" className="sr-only">
                Ünvan
              </label>
              <div className="relative">
              <input
                id="address"
                value={place?.address ?? ""}
                maxLength={ADDRESS_MAX}
                onChange={(e) => {
                  const v = e.target.value.slice(0, ADDRESS_MAX);
                  setHits(null);
                  // Yer hələ təyin olunmayıbsa xəritənin mərkəzi götürülür — yazmaq heç vaxt bloklanmır
                  setPlace((p) => {
                    const base = p ?? { ...(mapRef.current?.getCenter() ?? initial), locality: null, source: "map" as const, accuracy: null };
                    return { ...base, address: v, addressEdited: true };
                  });
                }}
                placeholder={geocoding ? "Ünvan müəyyənləşdirilir…" : "Küçə, ev nömrəsi və ya yaxın obyekt"}
                autoComplete="street-address"
                enterKeyHint="search"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (place?.addressEdited) void searchTyped();
                  e.currentTarget.blur();
                }}
                className="block w-full rounded-xl border-2 border-line bg-surface py-2 pl-3 pr-12 text-[1.0625rem] font-bold text-ink outline-none placeholder:text-[0.9375rem] placeholder:font-semibold placeholder:text-subtle focus:border-primary"
              />
              <button
                type="button"
                onClick={searchTyped}
                disabled={(place?.address?.trim().length ?? 0) < 3 || searching}
                aria-label="Ünvanı xəritədə tap"
                title="Ünvanı xəritədə tap"
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-primary-ink disabled:text-subtle"
              >
                {searching ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-[0.1563rem] border-line border-t-primary" />
                ) : (
                  <span className="h-5 w-5">
                    <Icon name="search" />
                  </span>
                )}
              </button>
              </div>
              {hits && (
                <ul className="mt-2 max-h-[11.5rem] overflow-y-auto rounded-xl border border-line" role="listbox" aria-label="Tapılan ünvanlar">
                  {hits.map((h, i) => (
                    <li key={`${h.lat},${h.lng},${i}`} className={i ? "border-t border-line-soft" : ""}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => applyHit(h)}
                        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-bg"
                      >
                        <span className="mt-0.5 h-4 w-4 flex-none text-muted">
                          <Icon name="pin" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[0.9375rem] font-semibold">{h.label}</span>
                          {h.locality && <span className="block truncate text-[0.8125rem] text-muted">{h.locality}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 flex items-center gap-2 px-1 text-sm text-muted">
                <span className="truncate">{place?.locality ?? (place ? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : "")}</span>
                {place?.addressEdited && place.autoAddress && place.autoAddress !== place.address && (
                  <button
                    type="button"
                    onClick={() => setPlace((p) => (p ? { ...p, address: p.autoAddress ?? null, addressEdited: false } : p))}
                    className="flex-none font-semibold text-primary-ink"
                  >
                    Avtomatik ünvan
                  </button>
                )}
              </div>
              {place?.source === "gps" && place.accuracy != null && place.accuracy > 150 ? (
                // Zəif dəqiqlik (məs. Wi-Fi/IP üzrə yer) — istifadəçi pini özü dəqiqləşdirməlidir
                <div className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-accent-badge-fg">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Təxmini yer (±{place.accuracy >= 1000 ? `${Math.round(place.accuracy / 1000)} km` : `${Math.round(place.accuracy)} m`}) — xəritədə dəqiqləşdirin
                </div>
              ) : place?.source === "gps" && place.accuracy != null ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-success">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  GPS · ±{Math.round(place.accuracy)} m dəqiqlik
                </div>
              ) : place ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-muted">
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
