import { CATEGORIES, type CategoryKey } from "@/lib/categories";

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];

/** "indicə", "25 dəq əvvəl", "2 saat əvvəl", "dünən", "3 gün əvvəl", "12 sen" */
export function relativeTime(iso: string | Date, now: Date = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const sec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (sec < 60) return "indicə";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dəq əvvəl`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} saat əvvəl`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.ceil((startOfToday.getTime() - d.getTime()) / 86_400_000);
  if (dayDiff <= 1) return "dünən";
  if (dayDiff < 7) return `${dayDiff} gün əvvəl`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? "" : ` ${d.getFullYear()}`}`;
}

/** 350 → "350 m", 1234 → "1.2 km" */
export function formatDistance(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "";
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 9950 ? 1 : 0)} km`;
}

/**
 * Bildirişin başlığı. Formada ayrıca başlıq sahəsi yoxdur (dizayna uyğun) —
 * qeydin ilk cümləsi götürülür, qeyd boşdursa kateqoriya adı.
 */
const TITLE_MAX = 64;
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s|\n/)[0];

export function reportTitle(note: string | null | undefined, category: CategoryKey): string {
  const text = (note ?? "").trim();
  if (!text) return CATEGORIES[category].name;
  const first = firstSentence(text).replace(/[.!?]+$/, "");
  return first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX - 3).trimEnd()}…` : first;
}

/**
 * Detalda başlığın altındakı təsvir — qeydin başlıqda göstərilməyən hissəsi (təkrar olmasın).
 * Başlıq qısaldılıbsa (…), tam qeyd göstərilir; qeyd tək cümlədirsə — boş.
 */
export function reportDescription(note: string | null | undefined): string {
  const text = (note ?? "").trim();
  if (!text) return "";
  const first = firstSentence(text);
  if (first.replace(/[.!?]+$/, "").length > TITLE_MAX) return text;
  return text.slice(first.length).trim();
}

export function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" });
}
