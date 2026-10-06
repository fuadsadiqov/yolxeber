# YolXəbər

Sürücülər yolda gördükləri dəyişiklikləri (yeni nişan, sürət limiti, kamera, zolaq, dönüş qadağası, parklanma qaydası) bu mobil-first veb tətbiqdə şəkil/video, GPS yeri və qısa qeydlə paylaşırlar. Digər sürücülər bildirişləri xəritədə və lentdə görür, təsdiqləyir və seçdikləri ərazilər üçün push bildirişləri alırlar.

- Hesab yoxdur, hamı qonaq kimi işləyir. Səs, şikayət və rate limit cihaza bağlıdır (imzalı cookie).
- Qərarlar və dəyişikliklərin tarixçəsi: [DECISIONS.md](DECISIONS.md). Dizayn faylları: [`design/`](design/).

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Postgres 16 + PostGIS · Drizzle/postgres.js · Leaflet + OpenStreetMap · Serwist (PWA) · web-push · sharp/ffmpeg · Docker + Caddy.

---

## 1. Lokal işə salma (inkişaf)

**Tələblər:** Node.js 22.13+ (pnpm 11 bunu tələb edir), pnpm 11, Docker.

```bash
pnpm install
cp .env.example .env        # DEVICE_SECRET və ADMIN_JWT_SECRET-i dəyişin (faylda göstəriş var)
pnpm db:up                  # PostGIS konteyneri → localhost:5432
pnpm db:migrate             # sxem + trigger-lər
pnpm db:seed                # Bakıdan 25 nümunə bildiriş (+ şəkillər data/media-da)
pnpm dev                    # http://localhost:3000
```

| Səhifə | Ünvan |
|---|---|
| Xəritə | `/` |
| Lent | `/lent` |
| Bildiriş əlavə et | `/bildir` |
| Bildiriş detalı | `/bildiris/<id>` |
| Xəbərdarlıqlar | `/xeberdarliqlar` |
| Admin panel | `/admin` (giriş: `.env` → `ADMIN_USERNAME` / `ADMIN_PASSWORD`, default `admin` / `admin`) |

### Faydalı əmrlər

| Əmr | Nə edir |
|---|---|
| `pnpm db:migrate` | Yeni SQL migration-ları tətbiq edir, həddləri `.env`-dən `app_settings`-ə yazır |
| `pnpm db:seed` / `pnpm db:seed --reset` | Test məlumatları (`--reset` bütün bildiriş/səs/cihazları silir) |
| `pnpm vapid` | Push üçün VAPID açarları yaradır → `.env`-ə yazın |
| `pnpm typecheck` · `pnpm lint` · `pnpm build` | Yoxlamalar |
| `node scripts/icons.mjs` | PWA ikonlarını loqodan yenidən yaradır |

### İnkişaf rejimində qeydlər

- **Service worker və push dev rejimində söndürülüb.** PWA, oflayn rejim və push bildirişlərini yoxlamaq üçün: `pnpm build && pnpm start`.
- **Video yükləmə** üçün sistemdə `ffmpeg` və `ffprobe` olmalıdır, yoxdursa server videonu rədd edir. Yolları `FFMPEG_PATH` / `FFPROBE_PATH` ilə dəyişmək olar. Docker image-də ffmpeg var.
- **Kamera və GPS telefonda yalnız HTTPS-də işləyir.** Telefondan test etmək üçün production qurulumu (Caddy) və ya HTTPS tunel (`cloudflared tunnel --url http://localhost:3000`, `ngrok http 3000`) istifadə edin.

---

## 2. Production (öz server, Docker)

```bash
cp .env.example .env
#   DOMAIN=yolxeber.example.az           ← DNS bu serverə yönəlməlidir (80/443 açıq)
#   DEVICE_SECRET, ADMIN_JWT_SECRET       ← təsadüfi uzun sətirlər
#   ADMIN_PASSWORD                        ← mütləq dəyişin
#   POSTGRES_PASSWORD                     ← dəyişin
#   NOMINATIM_USER_AGENT                  ← real əlaqə e-poçtu ilə
#   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  ← pnpm vapid (və ya npx web-push generate-vapid-keys)

docker compose --profile prod up -d --build
docker compose --profile tools run --rm seed --reset    # istəyə bağlı: test məlumatları
```

- `db` (PostGIS), `app` (Next.js, hər başlanğıcda migration-ları tətbiq edir) və `caddy` (avtomatik HTTPS, `/media/*`-i birbaşa volume-dan verir) konteynerləri işə düşür.
- Volume-lar: `pgdata` (baza), `media` (yüklənən fayllar), `caddy_data` (sertifikatlar). **Backup:** `pg_dump` və `media` volume-u.
- Sağlamlıq yoxlaması: `GET /api/health`.
- `NEXT_PUBLIC_TILE_*` dəyişənləri build zamanı koda yazılır. Dəyişəndən sonra `--build` ilə yenidən qurun.

> **Xəritə plitələri:** default olaraq `tile.openstreetmap.org` istifadə olunur. OSM-in [istifadə qaydası](https://operations.osmfoundation.org/policies/tiles/) yüksək trafikə icazə vermir. Real istifadəçilərə açmazdan əvvəl öz plitə serverinizi və ya provayderi (MapTiler, Stadia, Thunderforest və s.) `NEXT_PUBLIC_TILE_URL` ilə qoşun.

---

## 3. Test siyahısı

Seed-dən sonra:

1. **Xəritə:** Bakıda rəngli pinlər görünür, uzaqlaşanda qruplaşır (cluster). "Azadlıq pr." bildirişi solğundur, çünki arxivdədir. "Mərdanov qardaşları" spam bildirişi görünmür, çünki gizlədilib.
2. **Lent:** "Ən yeni / Ən yaxın / Ən çox təsdiqlənən" sıralamaları işləyir, aşağı sürüşdürəndə yeni səhifə yüklənir.
3. **Bildiriş əlavə et:** şəkil çəkin → yer → kateqoriya və qeyd → "Paylaş" → uğur ekranı.
   - Yüklənən şəkil ən çox 1600px WebP olmalı və EXIF saxlamamalıdır (`data/media/r/...`).
   - Bir saatda 21-ci bildiriş rədd olunur (rate limit).
4. **Səsvermə:**
   - Öz bildirişinizdə düymələr yoxdur.
   - Başqa brauzerdən və ya inkoqnito pəncərədən (yeni cihaz) "Mən də gördüm" basın. 3 təsdiqdə "Təsdiqlənib" çıxır.
   - 3 "Artıq aktual deyil" səsindən sonra bildiriş solğunlaşır və arxivə düşür.
5. **Şikayət:** 3 fərqli cihazdan şikayət gələndə bildiriş gizlədilir və `/admin` → "Gizlədilənlər" bölməsinə düşür. Orada onu bərpa etmək, silmək və ya cihazı bloklamaq olar.
6. **Xəbərdarlıqlar:** (production build + HTTPS + VAPID lazımdır)
   - Ərazi əlavə edin və bildiriş icazəsi verin.
   - Başqa cihazdan həmin ərazidə uyğun kateqoriyada bildiriş paylaşın, push gəlməlidir.
7. **PWA:** "Ana ekrana əlavə et" işləyir. Bir dəfə açdıqdan sonra interneti kəsin: xəritə və lent keşdən açılır, keşdə olmayan səhifələr üçün oflayn səhifə göstərilir.
8. **Tema:** sistem ayarına uyğun açılır. Ay/günəş düyməsi əl ilə keçid edir, uzun basmaq sistem ayarına qaytarır.

---

## 4. Struktur

```
design/                    Claude Design faylları (referans)
drizzle/0001_init.sql      Sxem: PostGIS sahələri, indekslər, trigger-lər (səs/şikayət/həddlər)
scripts/                   migrate.mjs · seed.ts · icons.mjs
src/middleware.ts          Cihaz cookie-si (imzalı) + admin qorunması
src/app/
  (tabs)/                  Xəritə (/) və Lent (/lent) — alt tab bar ilə
  bildir/                  3 addımlı bildiriş axını
  bildiris/[id]/           Detal: media, mini xəritə, səsvermə, şikayət, paylaşma
  xeberdarliqlar/          Ərazi + kateqoriya seçimi, push
  admin/                   Admin panel və giriş
  api/                     REST endpoint-lər
  media/[...path]/         Media faylları (dev; production-da Caddy verir)
  sw.ts · manifest.ts      PWA
src/components/            map · feed · report · new-report · layout · ui
src/lib/                   db · reports · report-create · media-server · geocode · push · alerts · admin · client/*
```

### API

| Metod | Yol | Təsvir |
|---|---|---|
| GET | `/api/reports?bbox=w,s,e,n` | Xəritənin görünən ərazisindəki pinlər |
| POST | `/api/reports` | Yeni bildiriş (multipart: `category`, `note`, `lat`, `lng`, `media[]`) |
| GET | `/api/reports/nearby?lat&lng&r` | Yaxınlıqdakı son dəyişikliklər |
| GET | `/api/feed?sort=new\|near\|top&lat&lng&cursor` | Lent |
| GET | `/api/reports/:id` | Detal |
| POST | `/api/reports/:id/vote` | `{kind: "confirm" \| "outdated"}` |
| POST | `/api/reports/:id/flag` | `{reason, comment?}` |
| GET | `/api/geocode?lat&lng` | Ünvan (Nominatim proksi + keş) |
| GET/POST, PUT/DELETE | `/api/alerts`, `/api/alerts/:id` | Xəbərdarlıq əraziləri |
| GET · POST · POST | `/api/push/key` · `/subscribe` · `/unsubscribe` | Web push |
| POST | `/api/admin/login` · `/logout` | Admin girişi |
| POST | `/api/admin/reports/:id` · `/api/admin/devices/:id` | Bərpa/silmə · bloklama |
