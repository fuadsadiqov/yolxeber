"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client/api";
import { relativeTime } from "@/lib/format";
import type { ReportDetail, ReportStatus } from "@/lib/types";
import { CategoryLabel, STRIPES, StatusBadge } from "./bits";

/** Xəritədə pin seçiləndə görünən kart (dizayn 11 — masaüstü popup). */
export function SelectedCard({ id, onClose }: { id: string; onClose: () => void }) {
  const [r, setR] = useState<ReportDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    setR(null);
    setFailed(false);
    api<ReportDetail>(`/api/reports/${id}`)
      .then((d) => alive && setR(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);

  async function confirm() {
    if (!r) return;
    setBusy(true);
    try {
      const res = await api<{ status: ReportStatus; confirmCount: number }>(`/api/reports/${r.id}/vote`, {
        method: "POST",
        json: { kind: "confirm" },
      });
      setR({ ...r, ...res, myVote: "confirm" });
      toast("Təşəkkürlər! Təsdiqiniz qeydə alındı.", { icon: "check" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xəta baş verdi");
    } finally {
      setBusy(false);
    }
  }

  const cover = r?.media[0];
  return (
    <div
      className="absolute inset-x-3 z-[700] overflow-hidden rounded-[18px] bg-surface shadow-[0_12px_32px_rgba(22,33,28,.25)] md:left-5 md:right-auto md:top-5 md:w-[300px] dark:border dark:border-line"
      style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
      role="dialog"
      aria-label={r?.title ?? "Bildiriş"}
    >
      <div className="relative h-[130px]" style={{ background: STRIPES }}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.thumbUrl ?? cover.url} alt="" className="h-full w-full object-cover" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#16211C]"
        >
          <span className="h-[18px] w-[18px]">
            <Icon name="x" />
          </span>
        </button>
      </div>
      <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
        {!r && !failed && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <div className="h-3 w-1/3 rounded bg-skeleton" />
            <div className="h-4 w-3/4 rounded bg-surface-muted" />
            <div className="h-3 w-2/3 rounded bg-skeleton" />
          </div>
        )}
        {failed && <p className="text-sm text-muted">Bildiriş tapılmadı və ya silinib.</p>}
        {r && (
          <>
            <div className="flex items-center gap-1.5">
              <CategoryLabel category={r.category} />
              <StatusBadge status={r.status} />
            </div>
            <div className="text-[17px] font-bold leading-snug">{r.title}</div>
            <div className="text-[13px] text-muted">
              {[r.address, relativeTime(r.createdAt), `${r.confirmCount} təsdiq`].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1.5 flex gap-2">
              {r.isOwn ? (
                <span className="flex h-11 flex-1 items-center justify-center rounded-xl bg-line-soft text-[13px] font-semibold text-muted">
                  Sizin bildirişiniz
                </span>
              ) : (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy || !!r.myVote}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-60"
                >
                  <span className="h-[18px] w-[18px]">
                    <Icon name={r.myVote ? "check" : "thumb"} />
                  </span>
                  {r.myVote === "confirm" ? "Təsdiqlədiniz" : r.myVote ? "Səs verdiniz" : "Təsdiqləyirəm"}
                </button>
              )}
              <Link
                href={`/bildiris/${r.id}`}
                className="flex h-11 items-center rounded-xl border-[1.5px] border-line-strong px-3.5 text-sm font-semibold"
              >
                Ətraflı
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
