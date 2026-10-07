"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { MediaItem } from "@/lib/types";

const ZOOM = 2.5;

/**
 * Tam ekran media baxışı: sürüşdürmə ilə keçid, iki dəfə toxunma ilə böyütmə,
 * Esc / X / telefonun "geri" düyməsi ilə bağlanma.
 */
export function MediaViewer({
  media,
  start,
  title,
  onClose,
}: {
  media: MediaItem[];
  start: number;
  title: string;
  onClose: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const zoomBox = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const indexRef = useRef(start);
  indexRef.current = index;
  const [zoomed, setZoomed] = useState<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const closedByPop = useRef(false);

  // Açılışda və böyütmədən çıxanda (karusel yenidən render olunur) cari şəkilə animasiyasız keç
  useLayoutEffect(() => {
    const el = track.current;
    if (el && !zoomed) el.scrollLeft = indexRef.current * el.clientWidth;
  }, [zoomed]);

  // "Geri" düyməsi baxışı bağlasın: açılanda history-yə yazı, popstate gələndə bağla
  useEffect(() => {
    history.pushState({ yxViewer: true }, "");
    const onPop = () => {
      closedByPop.current = true;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // X və Esc: əlavə etdiyimiz history yazısını geri götürürük (popstate → onClose)
  const close = useCallback(() => {
    if (closedByPop.current) onClose();
    else history.back();
  }, [onClose]);

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || i < 0 || i >= media.length) return;
      setZoomed(null);
      el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    },
    [media.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomed) setZoomed(null);
        else close();
      } else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, go, index, zoomed]);

  // Böyüdüləndə toxunulan nöqtəni mərkəzə gətir
  useLayoutEffect(() => {
    const box = zoomBox.current;
    if (!box || !zoomed) return;
    box.scrollLeft = zoomed.x * box.scrollWidth - box.clientWidth / 2;
    box.scrollTop = zoomed.y * box.scrollHeight - box.clientHeight / 2;
  }, [zoomed]);

  /** İki dəfə toxunma / klik — böyüt və ya kiçilt */
  function onImageTap(e: React.MouseEvent<HTMLImageElement>) {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (zoomed) setZoomed(null);
      else {
        const r = e.currentTarget.getBoundingClientRect();
        setZoomed({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }
    } else lastTap.current = now;
  }

  const current = media[index];

  return (
    <div className="fixed inset-0 z-[1600] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={`${title} — şəkillər`}>
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pb-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)", background: "linear-gradient(rgba(0,0,0,.55), transparent)" }}
      >
        <span className="text-sm font-semibold" aria-live="polite">
          {media.length > 1 ? `${index + 1} / ${media.length}` : ""}
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Bağla"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur"
          autoFocus
        >
          <span className="h-6 w-6">
            <Icon name="x" />
          </span>
        </button>
      </div>

      {zoomed && current?.kind === "image" ? (
        // Böyüdülmüş görünüş — barmaqla sürüşdürərək şəklin hissələrinə baxmaq olur
        <div ref={zoomBox} className="no-scrollbar h-full w-full overflow-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={title}
            onClick={onImageTap}
            className="max-w-none select-none object-contain"
            style={{ width: `${ZOOM * 100}%`, height: `${ZOOM * 100}%` }}
            draggable={false}
          />
        </div>
      ) : (
        <div
          ref={track}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {media.map((m, i) => (
            <div key={m.id} className="flex h-full w-full flex-none snap-center items-center justify-center">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.url}
                  alt={i === 0 ? title : ""}
                  onClick={onImageTap}
                  className="max-h-full max-w-full select-none object-contain"
                  draggable={false}
                />
              ) : (
                <video
                  src={m.url}
                  poster={m.thumbUrl ?? undefined}
                  controls
                  playsInline
                  autoPlay={i === start}
                  className="max-h-full max-w-full"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Masaüstü: oxlar */}
      {media.length > 1 && !zoomed && (
        <>
          <NavButton dir="left" disabled={index === 0} onClick={() => go(index - 1)} />
          <NavButton dir="right" disabled={index === media.length - 1} onClick={() => go(index + 1)} />
        </>
      )}

      {current?.kind === "image" && (
        <p
          className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-xs text-white/60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
        >
          {zoomed ? "Kiçiltmək üçün iki dəfə toxunun" : "Böyütmək üçün iki dəfə toxunun"}
        </p>
      )}
    </div>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Əvvəlki" : "Növbəti"}
      className={`absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur disabled:opacity-30 md:flex ${
        dir === "left" ? "left-4" : "right-4"
      }`}
    >
      <span className="h-6 w-6">
        <Icon name={dir === "left" ? "chevL" : "chevR"} />
      </span>
    </button>
  );
}
