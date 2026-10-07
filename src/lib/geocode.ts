import "server-only";
import { pg as sql } from "@/lib/db";
import { env } from "@/lib/env";

export type GeocodeResult = { address: string | null; locality: string | null };

const DEFAULT_UA = "YolXeber/1.0 (+https://github.com/fuadsadiqov/yolxeber)";
/** Nominatim nümunə dəyərləri (example.com) 403 ilə bloklayır — belə olduqda default-a keçirik. */
const userAgent = () => (/example\.(com|org)/i.test(env.NOMINATIM_USER_AGENT) ? DEFAULT_UA : env.NOMINATIM_USER_AGENT);

let warned = false;
function warnOnce(status: number) {
  if (warned) return;
  warned = true;
  console.warn(`Nominatim ${status} qaytardı — NOMINATIM_USER_AGENT və istifadə limitini yoxlayın`);
}

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
  const locality = [area && shorten(area), city && shorten(city)].filter(Boolean).join(", ") || null;
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
      fetch(url, { headers: { "User-Agent": userAgent() }, signal: AbortSignal.timeout(6000) }),
    );
    if (!res.ok) {
      warnOnce(res.status);
      return { address: null, locality: null };
    }
    const json = (await res.json()) as { address?: NominatimAddress; display_name?: string };
    const result = formatNominatim(json.address, json.display_name);
    await sql`INSERT INTO geocode_cache (key, address, locality) VALUES (${key}, ${result.address}, ${result.locality})
              ON CONFLICT (key) DO NOTHING`;
    return result;
  } catch {
    return { address: null, locality: null };
  }
}

export type GeocodeHit = GeocodeResult & { lat: number; lng: number; label: string };

// Axtarış nəticələri yaddaşda keşlənir (eyni sorğu təkrar Nominatim-ə getməsin).
const SEARCH_TTL_MS = 24 * 3600_000;
const searchCache = new Map<string, { at: number; items: GeocodeHit[] }>();

type NominatimSearchRow = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

/**
 * Mətndən koordinat (forward geocoding) — istifadəçi ünvanı əl ilə yazıb axtaranda.
 * Azərbaycanla məhdudlaşır, `near` verilibsə həmin ərazidəki nəticələrə üstünlük verilir.
 * Qeyd: Nominatim qaydası avtomatik tamamlamanı (hər hərfdə sorğu) qadağan edir — yalnız açıq axtarış.
 */
export async function searchAddress(q: string, near: { lat: number; lng: number } | null): Promise<GeocodeHit[]> {
  const norm = q.trim().replace(/\s+/g, " ").toLocaleLowerCase("az");
  const key = near ? `${norm}@${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : norm;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.items;

  const url = new URL("/search", env.NOMINATIM_URL);
  const params: Record<string, string> = {
    q: q.trim(),
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "az",
    "accept-language": "az",
  };
  if (near) {
    // Təxminən ±25 km — nəticələri bu əraziyə meylləndirir, amma məhdudlaşdırmır (bounded=0)
    const d = 0.25;
    params.viewbox = [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(",");
    params.bounded = "0";
  }
  url.search = new URLSearchParams(params).toString();

  try {
    const res = await throttled(() =>
      fetch(url, { headers: { "User-Agent": userAgent() }, signal: AbortSignal.timeout(8000) }),
    );
    if (!res.ok) {
      warnOnce(res.status);
      return [];
    }
    const rows = (await res.json()) as NominatimSearchRow[];
    const seen = new Set<string>();
    const items: GeocodeHit[] = [];
    for (const r of rows) {
      const f = formatNominatim(r.address, r.display_name);
      // Obyekt adı (məs. "Gənclik metro stansiyası") önə əlavə olunur — amma istifadəçi ev nömrəli
      // ünvan yazıbsa yox (yoxsa "Nizami küç. 64" axtarışı həmin binadakı restoranın adını gətirir)
      const typedAddress = /\d/.test(q);
      const name = typedAddress && f.address ? undefined : r.name?.trim();
      const label =
        name && f.address && !f.address.includes(name)
          ? `${name}, ${f.address}`
          : (name || f.address || r.display_name?.split(",")[0] || q.trim());
      const dedupe = `${label}|${f.locality}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      items.push({ lat: Number(r.lat), lng: Number(r.lon), label, address: f.address, locality: f.locality });
    }
    if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value!);
    searchCache.set(key, { at: Date.now(), items });
    return items;
  } catch {
    return [];
  }
}
