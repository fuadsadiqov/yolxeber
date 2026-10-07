"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, STRIPES } from "@/components/report/bits";
import { Comments } from "@/components/report/Comments";
import { MediaViewer } from "@/components/report/MediaViewer";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client/api";
import { distanceM, useGeo } from "@/lib/client/geo";
import { CATEGORIES } from "@/lib/categories";
import { formatDistance, relativeTime } from "@/lib/format";
import type { ReportDetail, ReportStatus, VoteKind } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

const FLAG_REASONS = [
  { value: "wrong", label: "Səhv və ya yanlış məlumat" },
  { value: "spam", label: "Spam / reklam" },
  { value: "offensive", label: "Təhqiramiz məzmun" },
  { value: "privacy", label: "Şəxsi məlumat görünür (üz, nömrə nişanı)" },
  { value: "other", label: "Digər" },
] as const;

export function ReportDetailView({ initial }: { initial: ReportDetail }) {
  const router = useRouter();
  const toast = useToast();
  const { position } = useGeo();
  const [r, setR] = useState(initial);
  const [busy, setBusy] = useState<VoteKind | null>(null);
  const [slide, setSlide] = useState(0);
  const [flagOpen, setFlagOpen] = useState(false);
  /** Tam ekran baxışda açılan media indeksi (null — bağlıdır) */
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const closeViewer = useCallback(() => setViewerAt(null), []);
  // Server və müştəri render-i eyni olsun deyə origin yalnız mount-dan sonra oxunur
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  const cat = CATEGORIES[r.category];

  const dist = position ? distanceM(position, r) : r.distanceM;
  const pin = useMemo(() => ({ lat: r.lat, lng: r.lng, category: r.category }), [r.lat, r.lng, r.category]);
  const shareUrl = `${origin}/bildiris/${r.id}`;
  const shareText = `${r.title}${r.address ? ` — ${r.address}` : ""} (YolXəbər)`;

  async function vote(kind: VoteKind) {
    setBusy(kind);
    try {
      const res = await api<{ status: ReportStatus; confirmCount: number; outdatedCount: number }>(`/api/reports/${r.id}/vote`, {
        method: "POST",
        json: { kind },
      });
      setR((x) => ({ ...x, ...res, myVote: kind }));
      toast(kind === "confirm" ? "Təşəkkürlər! Təsdiqiniz qeydə alındı." : "Qeyd olundu. Təşəkkürlər!", { icon: "check" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xəta baş verdi");
      if (e instanceof ApiError && e.code === "already_voted") setR((x) => ({ ...x, myVote: x.myVote ?? kind }));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: r.title, text: shareText, url: shareUrl });
      } catch {
        /* istifadəçi ləğv etdi */
      }
    } else copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Link kopyalandı", { icon: "link" });
    } catch {
      toast(shareUrl);
    }
  }

  const back = () => (history.length > 1 ? router.back() : router.push("/"));
  const total = r.confirmCount + r.outdatedCount;

  return (
    <main className="mx-auto min-h-dvh max-w-[37.5rem] bg-bg pb-6 md:my-6 md:overflow-hidden md:rounded-[1.75rem]">
      {/* Media karuseli */}
      <div className="relative h-[20rem] md:h-[23.75rem]" style={{ background: STRIPES }}>
        {r.media.length > 0 && (
          <div
            className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          >
            {r.media.map((m, i) => (
              <div key={m.id} className="h-full w-full flex-none snap-center">
                {m.kind === "image" ? (
                  <button
                    type="button"
                    onClick={() => setViewerAt(i)}
                    aria-label="Şəkli tam ekranda aç"
                    className="block h-full w-full cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={i === 0 ? r.title : ""}
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <video
                    src={m.url}
                    poster={m.thumbUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full bg-black object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-x-4 flex justify-between" style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}>
          <RoundButton icon="chevL" label="Geri" onClick={back} />
          <div className="flex gap-2">
            {r.isOwn && <RoundButton icon="edit" label="Bildirişi düzəlt" onClick={() => router.push(`/bildiris/${r.id}/duzelt`)} />}
            <RoundButton icon="share" label="Paylaş" onClick={share} />
          </div>
        </div>
        {r.media.length > 1 && (
          <span className="absolute bottom-4 right-4 flex h-7 items-center rounded-full bg-[rgba(22,33,28,.72)] px-2.5 text-xs font-semibold text-white">
            {slide + 1} / {r.media.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-2 pt-5">
        {r.status === "outdated" && (
          <div className="flex items-center gap-3 rounded-[0.875rem] bg-line-soft px-3.5 py-3 text-muted">
            <span className="h-5 w-5 flex-none">
              <Icon name="ban" />
            </span>
            <span className="text-sm font-semibold">Sürücülər bu dəyişikliyin artıq aktual olmadığını bildirib. Bildiriş arxivdədir.</span>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            <span
              className="flex h-[1.875rem] items-center gap-1.5 rounded-full pl-1.5 pr-3 text-[0.8125rem] font-semibold"
              style={{ background: cat.color, color: cat.fg }}
            >
              <span className="h-[1.125rem] w-[1.125rem]">
                <Icon name={cat.icon} />
              </span>
              {cat.name}
            </span>
            <StatusBadge status={r.status} size="md" />
          </div>
          <h1 className="text-[1.625rem] leading-tight font-bold text-balance">{r.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-4 w-4">
              <Icon name="clock" />
            </span>
            <time suppressHydrationWarning dateTime={r.createdAt} title={new Date(r.createdAt).toLocaleString("az-AZ")}>
              {relativeTime(r.createdAt)}
            </time>
            {r.editedAt && <span title={new Date(r.editedAt).toLocaleString("az-AZ")}>· düzəliş edilib</span>}
          </div>
        </div>

        {/* Ünvan + mini xəritə */}
        <div className="overflow-hidden rounded-[1.125rem] bg-surface">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
              <span className="h-5 w-5">
                <Icon name="pin" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold">{r.address ?? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`}</div>
              <div className="truncate text-[0.8125rem] text-muted">
                {[r.locality, dist != null ? formatDistance(dist) : null].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="relative h-[9.375rem] overflow-hidden">
            <MapCanvas center={r} zoom={16} interactive={false} pin={pin} />
            <Link
              href={`/?${new URLSearchParams({ r: r.id, lat: String(r.lat), lng: String(r.lng) })}`}
              className="absolute bottom-2.5 right-2.5 z-[600] flex h-9 items-center rounded-full bg-surface px-3 text-[0.8125rem] font-bold text-primary-ink shadow-[0_2px_6px_rgba(22,33,28,.18)]"
            >
              Xəritədə aç
            </Link>
          </div>
        </div>

        <NavigateSection lat={r.lat} lng={r.lng} title={r.title} />

        {r.note && (
          <section>
            <h2 className="mb-1.5 text-[0.8125rem] font-semibold tracking-[.06em] text-muted">QEYD</h2>
            <p className="text-base leading-normal whitespace-pre-line text-pretty">{r.note}</p>
          </section>
        )}

        {/* Səsvermə */}
        <section className="flex flex-col gap-3 rounded-[1.125rem] bg-surface p-4" aria-label="Təsdiqləmə">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl leading-none font-bold text-success">{r.confirmCount}</span>
            <span className="text-[0.9375rem] font-semibold">sürücü təsdiqləyib</span>
            <span className="ml-auto text-[0.8125rem] text-muted">{r.outdatedCount} aktual deyil</span>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded" aria-hidden="true">
            {total === 0 ? (
              <div className="flex-1 bg-line" />
            ) : (
              <>
                {r.confirmCount > 0 && <div className="bg-[#15803D]" style={{ flex: r.confirmCount }} />}
                {r.outdatedCount > 0 && <div className="bg-danger" style={{ flex: r.outdatedCount }} />}
              </>
            )}
          </div>
          {r.isOwn ? (
            <div className="flex flex-col gap-2">
              <p className="rounded-xl bg-line-soft px-3 py-3 text-center text-sm text-muted">
                Bu sizin bildirişinizdir — öz bildirişinizə səs verə bilməzsiniz.
              </p>
              <Link
                href={`/bildiris/${r.id}/duzelt`}
                className="flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl border-[0.0938rem] border-line-strong text-[0.9375rem] font-semibold"
              >
                <span className="h-5 w-5">
                  <Icon name="edit" />
                </span>
                Bildirişi düzəlt
              </Link>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => vote("confirm")}
                disabled={!!r.myVote || busy != null}
                className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-primary text-base font-bold text-white disabled:opacity-55"
              >
                <span className="h-[1.375rem] w-[1.375rem]">
                  <Icon name={r.myVote === "confirm" ? "check" : "thumb"} />
                </span>
                {r.myVote === "confirm" ? "Siz təsdiqlədiniz" : busy === "confirm" ? "Göndərilir…" : "Təsdiqləyirəm, mən də gördüm"}
              </button>
              <button
                type="button"
                onClick={() => vote("outdated")}
                disabled={!!r.myVote || busy != null}
                className="flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl border-[0.0938rem] border-line-strong text-[0.9375rem] font-semibold text-ink disabled:opacity-55"
              >
                <span className="h-5 w-5">
                  <Icon name="ban" />
                </span>
                {r.myVote === "outdated" ? "Siz “aktual deyil” bildirdiniz" : "Artıq aktual deyil"}
              </button>
            </>
          )}
        </section>

        {/* Paylaş */}
        <section>
          <h2 className="mb-2 text-[0.8125rem] font-semibold tracking-[.06em] text-muted">PAYLAŞ</h2>
          <div className="grid grid-cols-3 gap-2">
            <ShareLink href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`} icon="chat" color="#1DA851" label="WhatsApp" />
            <ShareLink
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
              icon="send"
              color="#1B8FCB"
              label="Telegram"
            />
            <button
              type="button"
              onClick={copyLink}
              className="flex h-[3.25rem] items-center justify-center gap-1.5 rounded-[0.875rem] border border-line bg-surface text-sm font-semibold"
            >
              <span className="h-5 w-5 text-primary-ink">
                <Icon name="link" />
              </span>
              Link
            </button>
          </div>
        </section>

        {!r.isOwn && (
          <button
            type="button"
            onClick={() => setFlagOpen(true)}
            disabled={r.myFlagged}
            className="flex min-h-[3.25rem] items-center justify-center gap-2 text-[0.9375rem] font-semibold text-danger-ink disabled:text-muted dark:text-danger-soft-ink"
          >
            <span className="h-[1.125rem] w-[1.125rem]">
              <Icon name="flag" />
            </span>
            {r.myFlagged ? "Şikayətiniz qəbul edilib" : "Səhv məlumat / şikayət et"}
          </button>
        )}

        <Comments reportId={r.id} />
      </div>

      {viewerAt != null && <MediaViewer media={r.media} start={viewerAt} title={r.title} onClose={closeViewer} />}

      <FlagSheet
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        reportId={r.id}
        onDone={() => {
          setFlagOpen(false);
          setR((x) => ({ ...x, myFlagged: true }));
          toast("Şikayətiniz göndərildi. Təşəkkürlər!", { icon: "check" });
        }}
      />
    </main>
  );
}

/**
 * Bildirişin koordinatını xarici xəritə/naviqasiya tətbiqlərində açır.
 * Universal linklər istifadə olunur: tətbiq quraşdırılıbsa tətbiq, yoxdursa veb versiya açılır.
 */
function NavigateSection({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const toast = useToast();
  const [isAndroid, setIsAndroid] = useState(false);
  useEffect(() => setIsAndroid(/Android/i.test(navigator.userAgent)), []);
  const ll = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const q = encodeURIComponent(title);

  const apps: { label: string; href: string; icon: IconName; color: string }[] = [
    { label: "Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${ll}`, icon: "pin", color: "#4285F4" },
    { label: "Waze", href: `https://waze.com/ul?ll=${ll}&navigate=yes`, icon: "navigation", color: "#1FB6E8" },
    { label: "Apple Xəritələr", href: `https://maps.apple.com/?ll=${ll}&q=${q}`, icon: "map", color: "#5B6678" },
    { label: "Yandex", href: `https://yandex.com/maps/?pt=${lng.toFixed(6)},${lat.toFixed(6)}&z=17&l=map`, icon: "route", color: "#FC3F1D" },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(ll);
      toast("Koordinat kopyalandı", { icon: "check" });
    } catch {
      toast(ll);
    }
  }

  return (
    <section aria-label="Xəritə tətbiqində aç">
      <h2 className="mb-2 text-[0.8125rem] font-semibold tracking-[.06em] text-muted">XƏRİTƏ TƏTBİQİNDƏ AÇ</h2>
      <div className="grid grid-cols-2 gap-2">
        {apps.map((a) => (
          <a
            key={a.label}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[3.25rem] items-center justify-center gap-2 rounded-[0.875rem] border border-line bg-surface px-2 text-sm font-semibold"
          >
            <span className="h-5 w-5 flex-none" style={{ color: a.color }}>
              <Icon name={a.icon} />
            </span>
            <span className="truncate">{a.label}</span>
          </a>
        ))}
        {isAndroid && (
          // Android: sistem seçim pəncərəsi — quraşdırılmış istənilən xəritə tətbiqi
          <a
            href={`geo:${ll}?q=${ll}(${q})`}
            className="col-span-2 flex h-[3.25rem] items-center justify-center gap-2 rounded-[0.875rem] border border-line bg-surface text-sm font-semibold"
          >
            <span className="h-5 w-5 text-primary-ink">
              <Icon name="share" />
            </span>
            Digər tətbiqlə aç
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[0.875rem] text-sm font-semibold text-muted"
      >
        <span className="h-4 w-4">
          <Icon name="copy" />
        </span>
        <span className="font-mono">{ll}</span> · kopyala
      </button>
    </section>
  );
}

function RoundButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#16211C] shadow-[0_2px_8px_rgba(22,33,28,.18)]"
    >
      <span className="h-[1.375rem] w-[1.375rem]">
        <Icon name={icon} />
      </span>
    </button>
  );
}

function ShareLink({ href, icon, color, label }: { href: string; icon: IconName; color: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[3.25rem] items-center justify-center gap-1.5 rounded-[0.875rem] border border-line bg-surface text-sm font-semibold"
    >
      <span className="h-5 w-5" style={{ color }}>
        <Icon name={icon} />
      </span>
      {label}
    </a>
  );
}

function FlagSheet({ open, onClose, reportId, onDone }: { open: boolean; onClose: () => void; reportId: string; onDone: () => void }) {
  const [reason, setReason] = useState<(typeof FLAG_REASONS)[number]["value"] | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reports/${reportId}/flag`, { method: "POST", json: { reason, comment: comment.trim() || undefined } });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_flagged") onDone();
      else setError(e instanceof ApiError ? e.message : "Xəta baş verdi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Şikayət et">
      <p className="mb-3 text-sm text-muted">Şikayətlər anonimdir. Bir neçə şikayətdən sonra bildiriş yoxlanılana qədər gizlədilir.</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Səbəb</legend>
        {FLAG_REASONS.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-[0.875rem] border-2 px-3.5 text-[0.9375rem] font-medium ${
              reason === o.value ? "border-primary bg-primary-soft" : "border-line"
            }`}
          >
            <input type="radio" name="reason" value={o.value} checked={reason === o.value} onChange={() => setReason(o.value)} className="h-5 w-5 accent-[#00A86B]" />
            {o.label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 280))}
        placeholder="Əlavə izah (istəyə bağlı)"
        rows={3}
        aria-label="Əlavə izah"
        className="mt-3 block w-full resize-none rounded-2xl border-2 border-line bg-surface px-3.5 py-3 text-[0.9375rem] outline-none placeholder:text-subtle focus:border-primary"
      />
      {error && <p className="mt-2 text-sm font-semibold text-danger-ink">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!reason || busy}
        className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl bg-danger text-base font-bold text-white disabled:opacity-50"
      >
        {busy ? "Göndərilir…" : "Şikayəti göndər"}
      </button>
    </Sheet>
  );
}
