"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatDistance, relativeTime } from "@/lib/format";
import type { ReportCard as Card } from "@/lib/types";
import { CategoryIcon, CategoryLabel, STRIPES, StatusBadge } from "./bits";

/** Lent kartı — dizayn: masaüstü paneldəki kart (84px miniatür, kateqoriya, başlıq, ünvan, məsafə · vaxt · təsdiq) */
export function ReportCard({
  r,
  selected = false,
  onClick,
}: {
  r: Card;
  selected?: boolean;
  /** Verilərsə, link əvəzinə bu çağırılır (masaüstü: xəritədə seçmək) */
  onClick?: (r: Card) => void;
}) {
  const body = (
    <>
      <div
        className="relative h-[5.75rem] w-[5.75rem] flex-none overflow-hidden rounded-xl md:h-[5.25rem] md:w-[5.25rem]"
        style={{ background: STRIPES }}
      >
        {r.thumbUrl && (
          // Miniatürlər serverdə 480px-ə qədər kiçildilib; lazy load
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        )}
        <CategoryIcon category={r.category} size={24} icon={14} radius={7} className="absolute left-1.5 top-1.5" />
        {r.hasVideo && (
          <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 p-1 text-white">
            <Icon name="video" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[0.1875rem]">
        <div className="flex min-h-5 items-center gap-1.5">
          <CategoryLabel category={r.category} />
          <StatusBadge status={r.status} />
        </div>
        <div className="truncate text-[0.9375rem] font-semibold text-ink">{r.title}</div>
        <div className="truncate text-[0.8125rem] text-muted">{[r.address, r.locality].filter(Boolean).join(", ") || "Ünvan təyin olunmayıb"}</div>
        <div className="mt-auto flex items-center gap-2.5 text-xs text-muted">
          {r.distanceM != null && <span className="font-bold text-ink">{formatDistance(r.distanceM)}</span>}
          <span>{relativeTime(r.createdAt)}</span>
          <span className="ml-auto flex items-center gap-[0.1875rem]" aria-label={`${r.confirmCount} təsdiq`}>
            <span className="h-3.5 w-3.5">
              <Icon name="thumb" />
            </span>
            {r.confirmCount}
          </span>
        </div>
      </div>
    </>
  );

  const cls = `flex gap-3 rounded-2xl border-[0.0938rem] bg-surface p-2.5 text-left ${
    selected ? "border-primary" : "border-transparent"
  }`;
  if (onClick)
    return (
      <button type="button" onClick={() => onClick(r)} className={`${cls} w-full`}>
        {body}
      </button>
    );
  return (
    <Link href={`/bildiris/${r.id}`} className={cls}>
      {body}
    </Link>
  );
}

/** Yaxınlıqdakılar paneli sətri — dizayn: 44px ikon, başlıq/ünvan, sağda məsafə/vaxt */
export function NearbyRow({ r, onClick }: { r: Card; onClick?: (r: Card) => void }) {
  const inner = (
    <>
      <CategoryIcon category={r.category} />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[0.9375rem] font-semibold text-ink">{r.title}</div>
        <div className="truncate text-[0.8125rem] text-muted">{[r.address, r.locality].filter(Boolean).join(", ")}</div>
      </div>
      <div className="flex-none text-right">
        <div className="text-sm font-semibold text-ink">{formatDistance(r.distanceM)}</div>
        <div className="text-xs text-muted">{relativeTime(r.createdAt)}</div>
      </div>
    </>
  );
  const cls = "flex min-h-[4.5rem] w-full items-center gap-3 border-t border-line-soft";
  return onClick ? (
    <button type="button" className={cls} onClick={() => onClick(r)}>
      {inner}
    </button>
  ) : (
    <Link href={`/bildiris/${r.id}`} className={cls}>
      {inner}
    </Link>
  );
}

export function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-[1.125rem] bg-surface p-2.5" aria-hidden="true">
      <div className="h-[5.75rem] w-[5.75rem] flex-none rounded-xl bg-skeleton" />
      <div className="flex flex-1 flex-col gap-[0.5625rem] pt-1">
        <div className="h-3 w-2/5 rounded-md bg-skeleton" />
        <div className="h-4 w-[85%] rounded-md bg-surface-muted" />
        <div className="h-3 w-[65%] rounded-md bg-skeleton" />
        <div className="mt-auto h-3 w-1/2 rounded-md bg-skeleton" />
      </div>
    </div>
  );
}
