/**
 * Test məlumatları: Bakıdan 25 nümunə bildiriş (+ yaradılmış şəkillər, səslər, şikayətlər).
 *
 *   pnpm db:seed           — baza boşdursa doldurur
 *   pnpm db:seed --reset   — bütün bildirişləri, səsləri, cihazları silib yenidən doldurur
 *
 * Statusları DB trigger-ləri özü hesablayır (səslər əlavə olunduqca).
 */
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import sharp from "sharp";
import { CATEGORIES, type CategoryKey } from "../src/lib/categories";
import { iconPath } from "../src/components/ui/icon-paths";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const MEDIA = resolve(process.env.MEDIA_DIR ?? "./data/media");
const reset = process.argv.includes("--reset");

type Seed = {
  cat: CategoryKey;
  lat: number;
  lng: number;
  address: string;
  locality: string;
  note: string;
  hoursAgo: number;
  confirms?: number;
  outdated?: number;
  flags?: number;
  photos?: number;
};

const DATA: Seed[] = [
  { cat: "kamera", lat: 40.4097, lng: 49.8795, address: "Heydər Əliyev pr. 115", locality: "Nərimanov r., Bakı", note: "Yeni sürət kamerası. Gənclik metrosu istiqamətində, işıqforun üstündə quraşdırılıb. Limit 60 km/saat.", hoursAgo: 0.4, confirms: 34, photos: 2 },
  { cat: "surat", lat: 40.3925, lng: 49.905, address: "Babək pr.", locality: "Xətai r., Bakı", note: "Limit 60 → 50 km/saat. Yeni nişan körpüdən sonra qoyulub.", hoursAgo: 2, confirms: 18 },
  { cat: "zolaq", lat: 40.418, lng: 49.89, address: "Ziya Bünyadov pr.", locality: "Nərimanov r., Bakı", note: "Yeni avtobus zolağı. Sağ zolaq yalnız ictimai nəqliyyat üçündür, 07:00–21:00.", hoursAgo: 26, confirms: 52, photos: 2 },
  { cat: "donus", lat: 40.383, lng: 49.841, address: "Füzuli küç. / R. Behbudov küç.", locality: "Nəsimi r., Bakı", note: "Sola dönüş qadağandır. Dönüş üçün növbəti işıqforadək getmək lazımdır.", hoursAgo: 3, confirms: 2 },
  { cat: "park", lat: 40.376, lng: 49.843, address: "Nizami küç. 64", locality: "Səbail r., Bakı", note: "Dayanma qadağası 08:00–20:00. Evakuator işləyir.", hoursAgo: 5, confirms: 12 },
  { cat: "nisan", lat: 40.393, lng: 49.817, address: "Tbilisi pr. 48", locality: "Yasamal r., Bakı", note: "“Giriş qadağandır” nişanı. Küçə birtərəfli edilib.", hoursAgo: 30, confirms: 1 },
  { cat: "kamera", lat: 40.379, lng: 49.902, address: "Nobel pr.", locality: "Xətai r., Bakı", note: "Orta sürəti ölçən kamera. Hər iki istiqamətdə işləyir.", hoursAgo: 8, confirms: 7 },
  { cat: "surat", lat: 40.465, lng: 49.803, address: "Bakı–Sumqayıt yolu", locality: "Binəqədi r., Bakı", note: "Limit 90 → 70 km/saat. Təmir işləri ilə əlaqədar müvəqqəti.", hoursAgo: 12, confirms: 4 },
  { cat: "zolaq", lat: 40.3685, lng: 49.854, address: "Neftçilər pr.", locality: "Səbail r., Bakı", note: "Bulvar boyunca yeni velosiped zolağı. Sağ zolaq daralıb.", hoursAgo: 50 },
  { cat: "donus", lat: 40.406, lng: 49.859, address: "Azadlıq pr.", locality: "Nərimanov r., Bakı", note: "U-dönüş bağlanıb.", hoursAgo: 72, confirms: 5, outdated: 3 },
  { cat: "park", lat: 40.372, lng: 49.848, address: "Xaqani küç.", locality: "Səbail r., Bakı", note: "Yeni ödənişli parklanma zonası. Saatı 0.60 AZN.", hoursAgo: 20, confirms: 9 },
  { cat: "nisan", lat: 40.378, lng: 49.807, address: "Mətbuat pr.", locality: "Yasamal r., Bakı", note: "“Yol ver” nişanı əlavə olunub, dairəvi hərəkətə girişdə.", hoursAgo: 6 },
  { cat: "kamera", lat: 40.37, lng: 49.94, address: "Zığ şos.", locality: "Xətai r., Bakı", note: "Yeni qırmızı işıq kamerası.", hoursAgo: 1.5, confirms: 3 },
  { cat: "diger", lat: 40.404, lng: 49.948, address: "Qara Qarayev pr.", locality: "Nizami r., Bakı", note: "Yol təmiri — sağ iki zolaq bağlıdır, təxminən 2 həftə davam edəcək.", hoursAgo: 4, confirms: 6 },
  { cat: "surat", lat: 40.415, lng: 49.96, address: "Heydər Əliyev pr.", locality: "Xətai r., Bakı", note: "Limit 80 km/saat. Əvvəl 90 idi.", hoursAgo: 40, confirms: 11 },
  { cat: "zolaq", lat: 40.379, lng: 49.85, address: "28 May küç.", locality: "Nəsimi r., Bakı", note: "Zolaq nişanlanması dəyişib: sol zolaq yalnız sola dönüş üçündür.", hoursAgo: 9 },
  { cat: "park", lat: 40.38, lng: 49.839, address: "Səməd Vurğun küç.", locality: "Nəsimi r., Bakı", note: "Hər iki tərəfdə dayanma qadağandır.", hoursAgo: 15, confirms: 2 },
  { cat: "kamera", lat: 40.398, lng: 49.86, address: "Moskva pr.", locality: "Nərimanov r., Bakı", note: "Mobil radar səhər saatlarında körpünün altında dayanır.", hoursAgo: 0.1 },
  { cat: "nisan", lat: 40.403, lng: 49.857, address: "Atatürk pr.", locality: "Nərimanov r., Bakı", note: "Piyada keçidi nişanı və yeni “zebra” çəkilib.", hoursAgo: 18, confirms: 4 },
  { cat: "donus", lat: 40.387, lng: 49.81, address: "Tbilisi pr. / H. Cavid pr.", locality: "Yasamal r., Bakı", note: "Sağa dönüş yalnız yaşıl oxla.", hoursAgo: 28 },
  { cat: "surat", lat: 40.43, lng: 49.88, address: "Ziya Bünyadov pr.", locality: "Nərimanov r., Bakı", note: "Limit 70 → 60 km/saat.", hoursAgo: 7, confirms: 3 },
  { cat: "diger", lat: 40.389, lng: 49.835, address: "Mərdanov qardaşları küç.", locality: "Nəsimi r., Bakı", note: "Reklam: ən ucuz təkərlər burada!!! Zəng edin.", hoursAgo: 2.5, flags: 3 },
  { cat: "zolaq", lat: 40.399, lng: 49.87, address: "Nərimanov pr.", locality: "Nərimanov r., Bakı", note: "İctimai nəqliyyat zolağı genişləndirilib.", hoursAgo: 44, confirms: 8 },
  { cat: "kamera", lat: 40.425, lng: 49.955, address: "Bakıxanov qəs.", locality: "Sabunçu r., Bakı", note: "Məktəb yaxınlığında yeni kamera, limit 40 km/saat.", hoursAgo: 11, confirms: 5 },
  { cat: "park", lat: 40.3705, lng: 49.837, address: "Fəvvarələr meydanı", locality: "Səbail r., Bakı", note: "", hoursAgo: 3.5, confirms: 1, flags: 1 },
];

/** Kateqoriya rəngində sadə "foto" — test üçün yer tutucu şəkil */
function placeholderSvg(cat: CategoryKey, variant: number) {
  const c = CATEGORIES[cat];
  const sky = variant % 2 ? "#9FB7CC" : "#B7C8D8";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#E4E9EE"/></linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <path d="M0 900 L520 430 L680 430 L1200 900 Z" fill="#4A5262"/>
  <path d="M600 440 L600 900" stroke="#F5F5F5" stroke-width="10" stroke-dasharray="40 40"/>
  <rect x="${variant % 2 ? 820 : 300}" y="250" width="14" height="420" fill="#6B7280"/>
  <g transform="translate(${variant % 2 ? 707 : 187},120)">
    <circle cx="120" cy="120" r="120" fill="${c.color}" stroke="#fff" stroke-width="14"/>
    <g transform="translate(48,48) scale(6)" fill="none" stroke="${c.fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath(c.icon)}"/></g>
  </g>
</svg>`;
}

async function save(key: string, buf: Buffer) {
  const p = resolve(MEDIA, key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, buf);
}

async function main() {
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM reports`;
  if (n > 0 && !reset) {
    console.log(`Bazada artıq ${n} bildiriş var. Yenidən doldurmaq üçün: pnpm db:seed --reset`);
    return;
  }
  if (reset) {
    await sql`TRUNCATE votes, flags, report_media, reports, alert_zones, push_subscriptions, admin_actions, devices CASCADE`;
    await rm(resolve(MEDIA, "r"), { recursive: true, force: true });
    console.log("✓ köhnə məlumatlar silindi");
  }

  // Səs verən "sürücülər" — ayrı-ayrı cihazlar
  const voters = Array.from({ length: 60 }, () => randomUUID());
  await sql`INSERT INTO devices (id) SELECT unnest(${sql.array(voters)}::uuid[])`;

  for (const [i, s] of DATA.entries()) {
    const author = randomUUID();
    const id = randomUUID();
    const createdAt = new Date(Date.now() - s.hoursAgo * 3600_000);
    await sql`INSERT INTO devices (id, created_at) VALUES (${author}::uuid, ${createdAt})`;
    await sql`
      INSERT INTO reports (id, device_id, category, note, location, address, locality, created_at, updated_at, status_changed_at)
      VALUES (${id}::uuid, ${author}::uuid, ${s.cat}, ${s.note},
              ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography,
              ${s.address}, ${s.locality}, ${createdAt}, ${createdAt}, ${createdAt})`;

    for (let p = 0; p < (s.photos ?? 1); p++) {
      const mid = randomUUID();
      const img = sharp(Buffer.from(placeholderSvg(s.cat, i + p)));
      const full = await img.clone().webp({ quality: 78 }).toBuffer();
      const thumb = await img.clone().resize(480).webp({ quality: 70 }).toBuffer();
      const key = `r/${id}/${mid}.webp`;
      const thumbKey = `r/${id}/${mid}_t.webp`;
      await save(key, full);
      await save(thumbKey, thumb);
      await sql`INSERT INTO report_media (id, report_id, kind, storage_key, thumb_key, width, height, size_bytes, position)
                VALUES (${mid}::uuid, ${id}::uuid, 'image', ${key}, ${thumbKey}, 1200, 900, ${full.length}, ${p})`;
    }

    // Səslər və şikayətlər — status trigger tərəfindən hesablanır
    const pool = [...voters].sort(() => Math.random() - 0.5);
    let k = 0;
    for (let v = 0; v < Math.min(s.confirms ?? 0, 50); v++) {
      await sql`INSERT INTO votes (report_id, device_id, kind) VALUES (${id}::uuid, ${pool[k++]}::uuid, 'confirm')`;
    }
    for (let v = 0; v < (s.outdated ?? 0); v++) {
      await sql`INSERT INTO votes (report_id, device_id, kind) VALUES (${id}::uuid, ${pool[k++]}::uuid, 'outdated')`;
    }
    for (let v = 0; v < (s.flags ?? 0); v++) {
      await sql`INSERT INTO flags (report_id, device_id, reason, comment)
                VALUES (${id}::uuid, ${pool[k++]}::uuid, 'spam', ${v === 0 ? "Reklamdır" : null})`;
    }
  }

  const stats = await sql<{ status: string; n: number }[]>`SELECT status, count(*)::int AS n FROM reports GROUP BY status ORDER BY status`;
  console.log(`✓ ${DATA.length} bildiriş əlavə olundu:`, Object.fromEntries(stats.map((s) => [s.status, s.n])));
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
