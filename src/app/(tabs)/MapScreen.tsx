"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapHandle, MapView } from "@/components/map/MapCanvas";
import { TopActions } from "@/components/layout/AppHeader";
import { FeedList } from "@/components/feed/FeedList";
import { Segmented, SORT_OPTIONS } from "@/components/report/bits";
import { NearbyRow } from "@/components/report/ReportCard";
import { SelectedCard } from "@/components/report/SelectedCard";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, qs } from "@/lib/client/api";
import { BAKU, useGeo } from "@/lib/client/geo";
import { useLocality } from "@/lib/client/useLocality";
import type { FeedSort, LatLng, MapReport, NearbySummary, ReportCard } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

const NEAR_RADIUS = 3000;

export function MapScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { position, locate } = useGeo();
  const toast = useToast();
  const mapRef = useRef<MapHandle>(null);

  // URL: /?r=<id>&lat=..&lng=.. — detal səhifəsindən "Xəritədə aç"
  const focus = (() => {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    return params.get("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  })();
  const [initialCenter] = useState<LatLng>(() => focus ?? BAKU);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("r"));
  const [reports, setReports] = useState<MapReport[]>([]);
  const [view, setView] = useState<MapView | null>(null);
  const [nearby, setNearby] = useState<NearbySummary | null>(null);
  const [nearbyFailed, setNearbyFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<FeedSort>("new");
  const userMoved = useRef(!!focus);
  const bboxAbort = useRef<AbortController | null>(null);
  const bboxTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // GPS mövqeyi ilk dəfə gələndə xəritəni ora aparırıq (istifadəçi özü sürüşdürməyibsə)
  useEffect(() => {
    if (position && !userMoved.current) {
      userMoved.current = true;
      mapRef.current?.flyTo(position, 14);
    }
  }, [position]);

  // Yalnız görünən ərazinin bildirişləri yüklənir; tez-tez sürüşdürmədə köhnə sorğu ləğv olunur.
  const onViewChange = useCallback((v: MapView) => {
    setView(v);
    clearTimeout(bboxTimer.current);
    bboxTimer.current = setTimeout(async () => {
      bboxAbort.current?.abort();
      const ac = new AbortController();
      bboxAbort.current = ac;
      const { west, south, east, north } = v.bbox;
      const bbox = [west, south, east, north].map((n) => n.toFixed(5)).join(",");
      try {
        const { items } = await api<{ items: MapReport[] }>(`/api/reports?${qs({ bbox })}`, { signal: ac.signal });
        setReports(items);
      } catch {
        /* şəbəkə xətası — mövcud pinlər qalır */
      }
    }, 250);
  }, []);

  // Panel: istifadəçinin yeri məlumdursa onun ətrafı, deyilsə xəritənin mərkəzi
  const origin = position ?? view?.center ?? null;
  const originKey = origin ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : null;
  const locality = useLocality(origin);
  useEffect(() => {
    if (!originKey) return;
    const [lat, lng] = originKey.split(",");
    let alive = true;
    api<NearbySummary>(`/api/reports/nearby?${qs({ lat, lng, r: NEAR_RADIUS })}`)
      .then((s) => {
        if (!alive) return;
        setNearby(s);
        setNearbyFailed(false);
      })
      .catch(() => alive && setNearbyFailed(true));
    return () => {
      alive = false;
    };
  }, [originKey]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (params.get("r")) router.replace("/", { scroll: false });
    },
    [params, router],
  );

  const openOnMap = useCallback(
    (r: ReportCard) => {
      setSelectedId(r.id);
      setExpanded(false);
      mapRef.current?.flyTo(r, 16);
    },
    [],
  );

  async function onLocate() {
    const fix = await locate();
    if (fix) mapRef.current?.flyTo(fix, 15);
    else
      toast("Yer məlumatına icazə verilməyib", {
        icon: "locate",
        action: { label: "İcazə ver", onClick: () => void locate() },
      });
  }

  const empty = nearby && nearby.items.length === 0;
  const subtitle = `${locality ?? "Bakı"} · ${NEAR_RADIUS / 1000} km radius`;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Masaüstü sol panel (dizayn 11) */}
      <aside className="hidden w-[27.5rem] flex-none flex-col gap-3.5 overflow-y-auto border-r border-line bg-bg px-5 pt-5 pb-6 md:flex">
        <div>
          <h1 className="text-[1.375rem] font-bold">Yaxınlıqdakı son dəyişikliklər</h1>
          <p className="mt-0.5 text-sm text-muted">
            {locality ?? "Bakı"} · {NEAR_RADIUS / 1000} km{nearby ? ` · ${nearby.items.length} bildiriş` : ""}
          </p>
        </div>
        <Segmented label="Sıralama" value={sort} options={SORT_OPTIONS} onChange={setSort} />
        <FeedList sort={sort} at={origin} selectedId={selectedId} onItemClick={openOnMap} />
      </aside>

      <div className="relative flex-1 overflow-hidden">
        <MapCanvas
          ref={mapRef}
          center={initialCenter}
          zoom={focus ? 16 : 14}
          reports={reports}
          selectedId={selectedId}
          onSelect={select}
          onViewChange={onViewChange}
          me={position}
        />

        {/* Yuxarı keçid (status bar altında oxunaqlılıq üçün) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-[5.625rem] md:hidden"
          style={{ background: "linear-gradient(var(--bg) 40%, transparent)" }}
        />
        <TopActions
          className="absolute right-4 z-[600] md:hidden"
          style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        />

        {selectedId && <SelectedCard id={selectedId} onClose={() => select(null)} />}

        {/* Masaüstü: mövqe + zoom düymələri (dizayn 11) */}
        <div className="absolute bottom-6 right-5 z-[600] hidden flex-col gap-2.5 md:flex">
          <MapButton icon="locate" label="Mənim yerim" onClick={onLocate} />
          <div className="flex w-12 flex-col rounded-[0.875rem] bg-surface text-ink shadow-float dark:border dark:border-line">
            <button type="button" aria-label="Yaxınlaşdır" onClick={() => mapRef.current?.zoomIn()} className="flex h-12 items-center justify-center border-b border-line">
              <span className="h-5 w-5"><Icon name="plus" /></span>
            </button>
            <button type="button" aria-label="Uzaqlaşdır" onClick={() => mapRef.current?.zoomOut()} className="flex h-12 items-center justify-center">
              <span className="h-5 w-5"><Icon name="minus" /></span>
            </button>
          </div>
        </div>

        {/* Mobil: alt panel + üzən düymələr. Konteyner toxunuşları tutmur — boş sahədə xəritə sürüşdürülə bilsin. */}
        <div
          className="pointer-events-none absolute inset-x-0 z-[600] md:hidden"
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
        >
          {!expanded && (
            <div className="flex flex-col items-end gap-3 px-4 pb-4">
              <MapButton icon="locate" label="Mənim yerim" onClick={onLocate} big />
              <Link
                href="/bildir"
                className="pointer-events-auto flex h-[3.625rem] items-center gap-2 rounded-full bg-accent pl-[1.125rem] pr-6 text-[1.0625rem] font-bold text-accent-ink shadow-fab"
              >
                <span className="h-6 w-6"><Icon name="plus" /></span>
                Bildir
              </Link>
            </div>
          )}

          {/* Default bağlıdır (yalnız başlıq görünür) — xəritə üçün maksimum yer; başlığa basanda açılır */}
          <section
            aria-label="Yaxınlıqdakı son dəyişikliklər"
            className="pointer-events-auto flex flex-col rounded-t-3xl bg-surface px-4 shadow-sheet transition-[height] duration-200 dark:border-t dark:border-line"
            style={{ height: expanded && !empty ? "min(72dvh, 40rem)" : "auto" }}
          >
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              aria-label={expanded ? "Paneli kiçilt" : "Paneli genişləndir"}
              className="flex w-full flex-none flex-col pb-3 text-left"
            >
              <span className="flex h-[1.1875rem] w-full items-center justify-center">
                <span className="h-[0.3125rem] w-10 rounded-full bg-line-strong" />
              </span>
              <span className="flex w-full items-start justify-between gap-3">
                <span>
                  <span className="block text-lg font-bold">Yaxınlıqdakı son dəyişikliklər</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-muted">
                    {subtitle}
                    {nearby ? ` · ${nearby.items.length} bildiriş` : ""}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-2">
                  {!!nearby?.newCount && (
                    <span className="rounded-xl bg-accent-badge-bg px-2.5 py-1 text-xs font-bold text-accent-badge-fg">
                      {nearby.newCount} yeni
                    </span>
                  )}
                  <span className={`h-5 w-5 text-muted transition-transform ${expanded ? "" : "rotate-180"}`}>
                    <Icon name="chevD" />
                  </span>
                </span>
              </span>
            </button>

            {expanded &&
              (empty ? (
                <div className="flex flex-col items-center px-2 pb-6 pt-2.5 text-center">
                  <span className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                    <span className="h-[2.125rem] w-[2.125rem]"><Icon name="pin" /></span>
                  </span>
                  <div className="mb-2 text-xl font-bold">Bu ərazidə hələ bildiriş yoxdur</div>
                  <p className="mb-5 text-[0.9375rem] leading-normal text-pretty text-muted">
                    Yeni nişan və ya kamera görsəniz, ilk bildirişi siz paylaşın.
                  </p>
                  <Link
                    href="/bildir"
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[1.0625rem] font-bold text-accent-ink"
                  >
                    <span className="h-[1.375rem] w-[1.375rem]"><Icon name="plus" /></span>
                    Bildir
                  </Link>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {!nearby && !nearbyFailed &&
                    [1, 2].map((i) => (
                      <div key={i} className="flex min-h-[4.5rem] items-center gap-3 border-t border-line-soft">
                        <span className="h-11 w-11 rounded-xl bg-skeleton" />
                        <div className="flex flex-1 flex-col gap-2">
                          <span className="h-3.5 w-3/4 rounded bg-surface-muted" />
                          <span className="h-3 w-1/2 rounded bg-skeleton" />
                        </div>
                      </div>
                    ))}
                  {nearbyFailed && !nearby && (
                    <p className="border-t border-line-soft py-5 text-center text-sm text-muted">
                      Bildirişləri yükləmək alınmadı. Bağlantını yoxlayın.
                    </p>
                  )}
                  {nearby?.items.map((r) => <NearbyRow key={r.id} r={r} onClick={openOnMap} />)}
                </div>
              ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function MapButton({ icon, label, onClick, big = false }: { icon: "locate"; label: string; onClick: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pointer-events-auto flex items-center justify-center bg-surface text-primary-ink shadow-float dark:border dark:border-line dark:text-ink ${
        big ? "h-[3.25rem] w-[3.25rem] rounded-2xl" : "h-12 w-12 rounded-[0.875rem]"
      }`}
    >
      <span className={big ? "h-6 w-6" : "h-[1.375rem] w-[1.375rem]"}>
        <Icon name={icon} />
      </span>
    </button>
  );
}
