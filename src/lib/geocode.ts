import "server-only";
import { pg as sql } from "@/lib/db";
import { env } from "@/lib/env";

export type GeocodeResult = { address: string | null; locality: string | null };

// Nominatim istifadə qaydası: saniyədə maksimum 1 sorğu. Bütün sorğular bu zəncirdən keçir.
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const wait = lastAt + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = next.catch(() => {});
  return next;
}

// Uzun yer adlarını dizayndakı qısa formaya salır: "Heydər Əliyev prospekti" → "Heydər Əliyev pr."
const ABBR: [RegExp, string][] = [
  [/\s+prospekti\b/i, " pr."],
  [/\s+küçəsi\b/i, " küç."],
  [/\s+döngəsi\b/i, " dön."],
  [/\s+şossesi\b/i, " şos."],
  [/\s+rayonu\b/i, " r."],
  [/\s+qəsəbəsi\b/i, " qəs."],
  [/\s+meydanı\b/i, " meyd."],
];
const shorten = (s: string) => ABBR.reduce((acc, [re, to]) => acc.replace(re, to), s.trim());

type NominatimAddress = Partial<
  Record<
    | "road" | "pedestrian" | "house_number" | "neighbourhood" | "suburb" | "city_district" | "district"
    | "city" | "town" | "village" | "county" | "state",
    string
  >
>;

export function formatNominatim(a: NominatimAddress | undefined, displayName?: string): GeocodeResult {
  if (!a) return { address: displayName?.split(",")[0] ?? null, locality: null };
  const road = a.road ?? a.pedestrian;
  const address = road ? shorten(a.house_number ? `${road} ${a.house_number}` : road) : (a.neighbourhood ?? a.suburb ?? null);
  const area = a.city_district ?? a.district ?? a.suburb ?? a.county;
  const city = a.city ?? a.town ?? a.village ?? a.state;
  const locality = [area && shorten(area), city].filter(Boolean).join(", ") || null;
  return { address, locality };
}

/** Koordinatdan ünvan. ~11 m dəqiqliklə DB-də keşlənir. Xəta olsa null-lar qaytarır, axını bloklamır. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const [hit] = await sql<GeocodeResult[]>`SELECT address, locality FROM geocode_cache WHERE key = ${key}`;
  if (hit) return hit;

  try {
    const url = new URL("/reverse", env.NOMINATIM_URL);
    url.search = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "1",
      "accept-language": "az",
    }).toString();
    const res = await throttled(() =>
      fetch(url, { headers: { "User-Agent": env.NOMINATIM_USER_AGENT }, signal: AbortSignal.timeout(6000) }),
    );
    if (!res.ok) return { address: null, locality: null };
    const json = (await res.json()) as { address?: NominatimAddress; display_name?: string };
    const result = formatNominatim(json.address, json.display_name);
    await sql`INSERT INTO geocode_cache (key, address, locality) VALUES (${key}, ${result.address}, ${result.locality})
              ON CONFLICT (key) DO NOTHING`;
    return result;
  } catch {
    return { address: null, locality: null };
  }
}
