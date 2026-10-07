"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CategoryLabel } from "@/components/report/bits";
import type { AdminComment, AdminReport } from "@/lib/admin";

const REASONS: Record<string, string> = {
  wrong: "Səhv məlumat",
  spam: "Spam / reklam",
  offensive: "Təhqiramiz",
  privacy: "Şəxsi məlumat",
  other: "Digər",
};
const STATUS: Record<string, [string, string]> = {
  active: ["Aktiv", "bg-line-soft text-muted"],
  verified: ["Təsdiqlənib", "bg-success-soft text-success"],
  outdated: ["Arxiv", "bg-line-soft text-muted"],
  hidden: ["Gizlədilib", "bg-danger-soft text-danger-soft-ink"],
  deleted: ["Silinib", "bg-line-soft text-muted"],
};

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) {
    location.href = "/admin/login";
    return false;
  }
  return res.ok;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<boolean>) => {
    setBusy(key);
    setError(null);
    const ok = await fn().catch(() => false);
    setBusy(null);
    if (ok) router.refresh();
    else setError("Əməliyyat alınmadı");
  };
  return { busy, error, run };
}

export function AdminReportRow({ r }: { r: AdminReport }) {
  const { busy, error, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [st, stCls] = STATUS[r.status];
  const btn = "h-10 rounded-xl px-3.5 text-sm font-semibold disabled:opacity-50";

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row">
      <div className="flex flex-none gap-1.5">
        {r.thumbs.slice(0, 2).map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t} src={t} alt="" loading="lazy" className="h-24 w-24 rounded-xl bg-skeleton object-cover" />
        ))}
        {!r.thumbs.length && <div className="h-24 w-24 rounded-xl bg-skeleton" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryLabel category={r.category} />
          <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${stCls}`}>{st}</span>
          {r.moderationLocked && <span className="text-[0.6875rem] font-semibold text-muted">· admin bərpa edib</span>}
        </div>
        <Link href={`/bildiris/${r.id}`} target="_blank" className="mt-1 block font-semibold hover:underline">
          {r.title}
        </Link>
        {r.note && r.note !== r.title && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{r.note}</p>}
        <p className="mt-1 text-[0.8125rem] text-muted">
          {[r.address, r.locality, new Date(r.createdAt).toLocaleString("az-AZ")].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          təsdiq {r.confirmCount} · aktual deyil {r.outdatedCount} · şikayət <b className="text-danger-ink">{r.flagCount}</b> · cihaz{" "}
          <span className="font-mono">{r.deviceId.slice(0, 8)}</span>
          {r.deviceBlocked && <b className="text-danger-ink"> (bloklanıb)</b>}
        </p>
        {r.flags.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-bg p-2.5 text-[0.8125rem]">
            {r.flags.slice(0, 5).map((f, i) => (
              <li key={i}>
                <b>{REASONS[f.reason] ?? f.reason}</b>
                {f.comment ? ` — ${f.comment}` : ""}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-sm font-semibold text-danger-ink">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {r.status === "hidden" && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("restore", () => post(`/api/admin/reports/${r.id}`, { action: "restore" }))}
              className={`${btn} bg-primary text-white`}
            >
              {busy === "restore" ? "…" : "Bərpa et"}
            </button>
          )}
          {confirmDelete ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run("delete", () => post(`/api/admin/reports/${r.id}`, { action: "delete" }))}
                className={`${btn} bg-danger text-white`}
              >
                {busy === "delete" ? "…" : "Bəli, sil"}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={`${btn} border-[0.0938rem] border-line-strong`}>
                Ləğv
              </button>
            </>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => setConfirmDelete(true)} className={`${btn} border-[0.0938rem] border-line-strong text-danger-ink`}>
              Sil
            </button>
          )}
          {!r.deviceBlocked && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run("block", () => post(`/api/admin/devices/${r.deviceId}`, { action: "block", reason: `Bildiriş ${r.id.slice(0, 8)}`, hideReports: true }))
              }
              className={`${btn} border-[0.0938rem] border-line-strong`}
              title="Cihaz yeni bildiriş, səs və şikayət göndərə bilməyəcək; aktiv bildirişləri gizlədiləcək"
            >
              {busy === "block" ? "…" : "Cihazı blokla"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AdminCommentRow({ c }: { c: AdminComment }) {
  const { busy, error, run } = useAction();
  const btn = "h-10 rounded-xl px-3.5 text-sm font-semibold disabled:opacity-50";
  return (
    <article className="rounded-2xl bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${c.hidden ? "bg-danger-soft text-danger-soft-ink" : "bg-line-soft text-muted"}`}>
          {c.hidden ? "Gizlədilib" : "Görünür"}
        </span>
        <span>
          şikayət <b className="text-danger-ink">{c.flagCount}</b>
        </span>
        <span>· {new Date(c.createdAt).toLocaleString("az-AZ")}</span>
        <span>
          · cihaz <span className="font-mono">{c.deviceId.slice(0, 8)}</span>
          {c.deviceBlocked && <b className="text-danger-ink"> (bloklanıb)</b>}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-[0.9375rem]">{c.body}</p>
      <Link href={`/bildiris/${c.reportId}`} target="_blank" className="mt-1 block text-[0.8125rem] font-semibold text-primary-ink hover:underline">
        Bildiriş: {c.reportTitle}
      </Link>
      {error && <p className="mt-2 text-sm font-semibold text-danger-ink">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {c.hidden && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("restore", () => post(`/api/admin/comments/${c.id}`, { action: "restore" }))}
            className={`${btn} bg-primary text-white`}
          >
            {busy === "restore" ? "…" : "Bərpa et"}
          </button>
        )}
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("delete", () => post(`/api/admin/comments/${c.id}`, { action: "delete" }))}
          className={`${btn} border-[0.0938rem] border-line-strong text-danger-ink`}
        >
          {busy === "delete" ? "…" : "Sil"}
        </button>
        {!c.deviceBlocked && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("block", () => post(`/api/admin/devices/${c.deviceId}`, { action: "block", reason: "Rəy", hideReports: false }))}
            className={`${btn} border-[0.0938rem] border-line-strong`}
          >
            {busy === "block" ? "…" : "Cihazı blokla"}
          </button>
        )}
      </div>
    </article>
  );
}

export function UnblockButton({ deviceId }: { deviceId: string }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-sm text-danger-ink">{error}</span>}
      <button
        type="button"
        disabled={!!busy}
        onClick={() => run("unblock", () => post(`/api/admin/devices/${deviceId}`, { action: "unblock" }))}
        className="h-10 rounded-xl border-[0.0938rem] border-line-strong px-3.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "…" : "Blokdan çıxar"}
      </button>
    </div>
  );
}
