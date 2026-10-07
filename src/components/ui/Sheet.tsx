"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/** Sadə modal alt panel (mobil) / mərkəzdə dialoq (masaüstü). Esc və fona toxunuş bağlayır. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center md:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-[30rem] overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2.5 outline-none md:rounded-3xl md:pb-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="mx-auto mb-3 h-[0.3125rem] w-10 rounded-full bg-line-strong md:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Bağla" className="-mr-2 flex h-11 w-11 items-center justify-center text-muted">
            <span className="h-5 w-5">
              <Icon name="x" />
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
