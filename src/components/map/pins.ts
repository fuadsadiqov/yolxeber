import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { iconPath } from "@/components/ui/icon-paths";

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

/** Xəritə pininin HTML-i (Leaflet divIcon üçün). Rənglər kateqoriyadan, ölçü/görünüş CSS-dən (globals.css → .yx-pin). */
export function pinHtml(category: CategoryKey, opts: { outdated?: boolean; selected?: boolean; small?: boolean } = {}) {
  const c = CATEGORIES[category];
  const cls = ["yx-pin", opts.outdated && "yx-pin--old", opts.selected && "yx-pin--sel", opts.small && "yx-pin--sm"].filter(Boolean).join(" ");
  return `<div class="${cls}" style="--c:${c.color};--fg:${c.fg}">${svg(iconPath(c.icon))}</div>`;
}

export const meHtml = `<div class="yx-me"><div></div></div>`;
