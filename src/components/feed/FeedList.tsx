"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CardSkeleton, ReportCard } from "@/components/report/ReportCard";
import { api, ApiError, qs } from "@/lib/client/api";
import { formatTime } from "@/lib/format";
import type { FeedPage, FeedSort, LatLng, ReportCard as Card } from "@/lib/types";

const LAST_OK = "yx-feed-ok";

/**
 * Sonsuz scroll ilə lent. Səhifənin sonuna yaxınlaşanda (IntersectionObserver) növbəti səhifə yüklənir.
 * Oflayn rejimdə service worker son cavabı keşdən qaytarır; səhv olsa xəta vəziyyəti göstərilir.
 */
export function FeedList({
  sort,
  at,
  selectedId,
  onItemClick,
}: {
  sort: FeedSort;
  at: LatLng | null;
  selectedId?: string | null;
  onItemClick?: (r: Card) => void;
}) {
  const [items, setItems] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "more" | "error" | "done">("loading");
  const [offline, setOffline] = useState(false);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Mövqe kiçik dəyişəndə lent yenidən yüklənməsin — ~100 m-ə yuvarlaqlaşdırırıq
  const atKey = at ? `${at.lat.toFixed(3)},${at.lng.toFixed(3)}` : "";

  const load = useCallback(
    async (reset: boolean, cur: string | null) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setState(reset ? "loading" : "more");
      try {
        const [lat, lng] = atKey ? atKey.split(",") : [null, null];
        const page = await api<FeedPage>(`/api/feed?${qs({ sort, lat, lng, cursor: reset ? null : cur })}`, {
          signal: ac.signal,
        });
        setItems((prev) => (reset ? page.items : [...prev, ...page.items.filter((x) => !prev.some((p) => p.id === x.id))]));
        setCursor(page.nextCursor);
        setState(page.nextCursor ? "idle" : "done");
        try {
          localStorage.setItem(LAST_OK, new Date().toISOString());
        } catch {}
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState("error");
        if (e instanceof ApiError && e.status === 0) setOffline(true);
      }
    },
    [sort, atKey],
  );

  useEffect(() => {
    void load(true, null);
  }, [load]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    try {
      setLastOk(localStorage.getItem(LAST_OK));
    } catch {}
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || state !== "idle") return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(false, cursor), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [state, cursor, load]);

  const offlineBanner = offline && (
    <div className="mb-3 flex items-center gap-3 rounded-[0.875rem] bg-danger-soft px-3.5 py-3 text-danger-soft-ink">
      <span className="h-[1.375rem] w-[1.375rem] flex-none">
        <Icon name="wifiOff" />
      </span>
      <div className="flex-1">
        <div className="text-[0.9375rem] font-bold">İnternet bağlantısı yoxdur</div>
        {lastOk && <div className="text-[0.8125rem] opacity-80">Son yenilənmə: {lastOkLabel(lastOk)}</div>}
      </div>
    </div>
  );

  if (state === "loading")
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Yüklənir">
        {offlineBanner}
        {[1, 2, 3, 4, 5].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );

  if (state === "error" && items.length === 0)
    return (
      <div>
        {offlineBanner}
        <div className="flex flex-col items-center px-8 pt-16 text-center">
          <span className="mb-5 flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full bg-surface text-danger shadow-[0_0_0_10px_var(--danger-soft)]">
            <span className="h-[2.375rem] w-[2.375rem]">
              <Icon name="wifiOff" />
            </span>
          </span>
          <div className="mb-2 text-[1.3125rem] font-bold">Bildirişləri yükləmək alınmadı</div>
          <p className="mb-[1.375rem] text-[0.9375rem] leading-normal text-pretty text-muted">
            Bağlantını yoxlayıb yenidən cəhd edin. Əvvəl baxdığınız bildirişlər oflayn qalır.
          </p>
          <button
            type="button"
            onClick={() => load(true, null)}
            className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-7 text-base font-bold text-white"
          >
            <span className="h-5 w-5">
              <Icon name="refresh" />
            </span>
            Yenidən cəhd et
          </button>
        </div>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="flex flex-col items-center px-6 pt-14 text-center">
        <span className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary-soft text-primary-ink">
          <span className="h-[2.125rem] w-[2.125rem]">
            <Icon name="pin" />
          </span>
        </span>
        <div className="mb-2 text-xl font-bold">{sort === "near" && !at ? "Yeriniz məlum deyil" : "Hələ bildiriş yoxdur"}</div>
        <p className="text-[0.9375rem] leading-normal text-pretty text-muted">
          {sort === "near" && !at
            ? "Ən yaxın bildirişləri görmək üçün yer məlumatına icazə verin."
            : "Yeni nişan və ya kamera görsəniz, ilk bildirişi siz paylaşın."}
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-2.5">
      {offlineBanner}
      {items.map((r) => (
        <ReportCard key={r.id} r={r} selected={r.id === selectedId} onClick={onItemClick} />
      ))}
      <div ref={sentinel} />
      {state === "more" && <CardSkeleton />}
      {state === "error" && (
        <button type="button" onClick={() => load(false, cursor)} className="h-12 font-semibold text-primary-ink">
          Yenidən cəhd et
        </button>
      )}
      {state === "done" && items.length > 5 && <p className="py-4 text-center text-sm text-muted">Hamısı göstərildi</p>}
    </div>
  );
}

function lastOkLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "bu gün" : d.toLocaleDateString("az-AZ")}, ${formatTime(d)}`;
}
