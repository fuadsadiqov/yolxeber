import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { Icon } from "@/components/ui/Icon";
import type { ReportStatus } from "@/lib/types";

/** Rəngli kateqoriya ikonu. size/icon/radius dizayndakı px dəyərləridir, rem-ə çevrilir (kök şriftlə miqyaslanır). */
const rem = (px: number) => `${px / 16}rem`;

export function CategoryIcon({
  category,
  size = 44,
  icon = 22,
  radius = 12,
  className = "",
}: {
  category: CategoryKey;
  size?: number;
  icon?: number;
  radius?: number | string;
  className?: string;
}) {
  const c = CATEGORIES[category];
  return (
    <span
      className={`flex flex-none items-center justify-center ${className}`}
      style={{ width: rem(size), height: rem(size), borderRadius: typeof radius === "number" ? rem(radius) : radius, background: c.color, color: c.fg }}
      aria-hidden="true"
    >
      <span style={{ width: rem(icon), height: rem(icon) }} className="flex">
        <Icon name={c.icon} />
      </span>
    </span>
  );
}

/** Lent kartında kateqoriya adı — açıq temada tünd ton, tünd temada parlaq ton. */
export function CategoryLabel({ category, short = false }: { category: CategoryKey; short?: boolean }) {
  const c = CATEGORIES[category];
  return (
    <span
      className="text-xs font-bold text-[var(--t)] dark:text-[var(--td)]"
      style={{ ["--t" as string]: c.text, ["--td" as string]: c.key === "diger" ? "#98A4B8" : c.key === "stop" ? "#F87171" : c.color }}
    >
      {short ? c.short : c.name}
    </span>
  );
}

export function StatusBadge({ status, size = "sm" }: { status: ReportStatus; size?: "sm" | "md" }) {
  if (status !== "verified" && status !== "outdated") return null;
  const verified = status === "verified";
  const md = size === "md";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        verified ? "bg-success-soft text-success" : "bg-line-soft text-muted"
      } ${md ? "h-[1.875rem] gap-[0.3125rem] pl-2 pr-3 text-[0.8125rem] font-bold" : "py-0.5 pl-1 pr-[0.4375rem] text-[0.6875rem]"}`}
    >
      <span className={md ? "h-4 w-4" : "h-3 w-3"}>
        <Icon name={verified ? (md ? "shield" : "check") : "ban"} />
      </span>
      {verified ? "Təsdiqlənib" : "Aktual deyil"}
    </span>
  );
}

/** Media olmayanda dizayndakı zolaqlı yer tutucu */
export const STRIPES =
  "repeating-linear-gradient(135deg, var(--line) 0 8px, color-mix(in srgb, var(--line) 60%, var(--surface)) 8px 16px)";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; grow?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl bg-surface-muted p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            style={{ flexGrow: o.grow ?? 1 }}
            className={`h-9 basis-0 rounded-[0.5625rem] px-1 text-[0.8125rem] whitespace-nowrap ${
              on ? "bg-surface font-bold text-ink shadow-[0_1px_3px_rgba(22,33,28,.12)]" : "font-semibold text-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const SORT_OPTIONS = [
  { value: "new" as const, label: "Ən yeni" },
  { value: "near" as const, label: "Ən yaxın" },
  { value: "top" as const, label: "Ən çox təsdiqlənən", grow: 1.4 },
];
