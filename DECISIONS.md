# Qərarlar jurnalı

Layihədəki əsas qərarlar və dəyişikliklər tarix üzrə. Ən yeni yazılar yuxarıdadır.

---

## 2026-10-06 — Server: portlar və deploy düzəlişləri

- Serverdə başqa layihələr **80, 443, 3000, 9090** portlarını tutur. Buna görə:
  - `app` konteyneri sərbəst porta çıxır: `${APP_BIND:-0.0.0.0}:${APP_PORT:-3100}`. `/media/*` fayllarını app-in özü verir (Range dəstəyi ilə).
  - Caddy ayrıca `caddy` profilinə keçirildi. Yalnız 80/443 boş olan serverdə istifadə olunur, portları `HTTP_PORT`/`HTTPS_PORT` ilə dəyişmək olar.
  - HTTPS mövcud reverse proxy ilə təmin olunur, nümunə nginx konfiqurasiyası README-dədir.
  - DB host portu `DB_PORT` ilə dəyişdirilə bilər (yalnız `127.0.0.1`).
- **Dockerfile `node:22-alpine`-a keçirildi.** pnpm 11 Node ≥ 22.13 tələb edir. pnpm corepack əvəzinə `npm i -g pnpm@11.11.0` ilə quraşdırılır.
- **`esbuild` və `unrs-resolver` postinstall skriptləri söndürüldü** (`pnpm-workspace.yaml`). Linux serverdə install-u dayandırırdılar, isteğe bağlıdırlar.

## 2026-10-06 — Mərhələ 6: admin panel, PWA, son yoxlamalar

- **Admin panel** (`/admin`) 4 bölmədən ibarətdir: Gizlədilənlər, Şikayət olunanlar, Son bildirişlər, Bloklanmış cihazlar.
  - **Bərpa et:** status səslərə görə yenidən hesablanır, `moderation_locked = true` olur.
  - **Sil:** soft delete. Sətir audit üçün qalır, media faylları diskdən silinir.
  - **Cihazı blokla:** cihaz artıq bildiriş, səs, şikayət və ərazi göndərə bilmir, aktiv bildirişləri gizlədilir.
  - Hər əməliyyat `admin_actions` cədvəlində qeyd olunur.
- **PWA:** `app/manifest.ts`, ikonlar (`scripts/icons.mjs`, loqodan yaradılır), **Serwist** service worker (`src/app/sw.ts`). Keş strategiyası:
  - Tətbiq qabığı və statik fayllar precache olunur, oflayn halda `/offline` səhifəsi göstərilir.
  - API-lər: əvvəl şəbəkə, alınmasa keş. Son baxılan lent və xəritə oflayn açılır.
  - Xəritə plitələri və şəkillər: əvvəl keş, limitli. Videolar keşlənmir (Range sorğuları).
  - Admin və yazma sorğuları heç vaxt keşlənmir.
- Service worker yalnız production build-də aktivdir. Dev-də köhnə keş səbəbilə qarışıqlıq yaranmasın deyə söndürülüb.
- **Təhlükəsizlik başlıqları:** `nosniff`, `Referrer-Policy`, `Permissions-Policy` (kamera/GPS yalnız öz saytımız üçün).
- **Xəritə plitələri: CARTO → OpenStreetMap (plandan dəyişiklik).** Yoxlama zamanı CARTO plitələri "API KEY REQUIRED" qaytardı.
  - Default olaraq OSM plitələri istifadə olunur. Tünd temada həmin plitələrə CSS filtri tətbiq olunur.
  - `NEXT_PUBLIC_TILE_URL*` dəyişənləri ilə istənilən provayder qoşula bilər.
  - OSM-in istifadə qaydası yüksək trafiki qadağan edir, ona görə production-da öz plitə provayderi tövsiyə olunur.
- **Docker-də test məlumatları:** `seed` servisi (`--profile tools`) əlavə olundu. O, build mərhələsinin image-ından istifadə edir və şəkilləri birbaşa media volume-a yazır.
- **Yoxlamalar** (bu maşında Docker işləmədiyi üçün):
  - `typecheck`, `lint` və `build` keçir.
  - Migration, trigger-lər və bütün əsas PostGIS sorğuları **PGlite + PostGIS** (yaddaş-daxili Postgres) üzərində 20 testlə yoxlanılıb, hamısı keçir:
    - öz bildirişinə səs/şikayət qadağası, təkrar səs;
    - 3/3/3 həddləri, bərpa və kilid;
    - bbox, ST_DWithin, kursorlar, zona ilə push uyğunluğu, rate limit.
  - UI production build-də brauzerdə yoxlanılıb: xəritə, 3 addımlı axın, lent, xəbərdarlıqlar, admin girişi, açıq və tünd tema.
  - Şəkil sıxışdırma (2400px → 1600px WebP) və serverdə EXIF/GPS silinməsi ayrıca test olunub.

## 2026-10-06 — Mərhələ 5: xəbərdarlıqlar və push bildirişləri

- **Ərazilər cihaza bağlıdır** (`alert_zones.device_id`). Hər ərazinin mərkəzi, 500 m–20 km radiusu və kateqoriyaları var. Bir cihaz ən çox 10 ərazi yarada bilər.
- **Redaktor:** xəritədə mərkəz pini sabitdir, radius dairəsi xəritə ilə birlikdə hərəkət edir. Radius sabit addımlarla seçilir (0.5/1/2/3/5/10/20 km). Kateqoriya toggle-ları dizayndakı `alertCats` kimidir: parklanma və "digər" default olaraq söndürülüb.
- **Push icazəsi** ilk ərazi saxlananda istənilir. Kontekst aydın olanda istifadəçinin razılaşma ehtimalı daha yüksəkdir.
- **iPhone:** push yalnız ana ekrana əlavə olunmuş PWA-da işləyir (iOS 16.4+). Ekranda bu barədə göstəriş var.
- **Göndərmə:**
  - Yeni bildiriş yaradılanda cavab qaytarıldıqdan sonra (`after()`) uyğun zonalar tapılır: radius daxilində + kateqoriya uyğundur + müəllifin öz zonası deyil.
  - `web-push` (VAPID) ilə göndərilir. 404/410 cavab verən abunəliklər silinir.
- Push üçün ayrıca növbə (queue) yoxdur, tək server üçün kifayətdir. Yük artsa, BullMQ və ya pg-boss-a keçmək məsləhətdir.

## 2026-10-06 — Mərhələ 4: detal səhifəsi, səsvermə, şikayət

- `/bildiris/[id]` server komponentidir. Paylaşma linkləri üçün OG meta (başlıq, təsvir, şəkil) yaradır, gizlədilmiş və ya silinmiş bildirişlər üçün 404 qaytarır.
- **Səsvermə:**
  - Optimistik deyil, server cavabı gözlənilir, çünki status həddi serverdə hesablanır.
  - Öz bildirişində düymələr gizlədilir və izah mətni göstərilir.
  - Səs verildikdən sonra düymələr deaktiv olur.
- **Şikayət:** 5 səbəb (səhv, spam, təhqiramiz, şəxsi məlumat, digər) və istəyə bağlı şərh. Hər cihaz bir bildirişə bir dəfə şikayət edə bilər.
- **Paylaşma:** WhatsApp (`wa.me`), Telegram (`t.me/share`), link kopyalama. Yuxarıdakı düymə mobil cihazda sistemin paylaşma menyusunu açır (`navigator.share`).
- Mini xəritə interaktiv deyil. "Xəritədə aç" düyməsi ana xəritəni həmin bildirişə fokuslanmış açır (`/?r=&lat=&lng=`).

## 2026-10-06 — Mərhələ 3: bildiriş əlavə etmə axını və media

- **Media tələb olunur** (ən azı 1, ən çox 4 fayl, bunlardan ən çox 1 video). Tətbiqin etibarlılığı şəkil sübutuna əsaslanır.
- **Brauzerdə:**
  - Şəkillər canvas ilə maksimum 1600px-ə kiçildilir və WebP-yə çevrilir. Safari WebP kodlaya bilmirsə, JPEG istifadə olunur. Canvas-dan yenidən kodlama EXIF-i də silir.
  - Video üçün 50 MB və 30 saniyə limiti yoxlanılır.
- **Serverdə** (ikinci qat, müştəriyə etibar edilmir):
  - Şəkil `sharp` ilə yenidən kodlanır. Metadata silinir, oriyentasiya piksellərə tətbiq olunur, 480px miniatür yaradılır.
  - Video `ffprobe` ilə yoxlanılır, `ffmpeg -map_metadata -1 -c copy` ilə təmizlənir (yenidən kodlaşdırılmır, sürətlidir), önizləmə kadrı çıxarılır.
  - ffmpeg yoxdursa video qəbul edilmir, çünki metadata-sı silinməmiş fayl saxlamırıq.
- **Yer:**
  - Pin ekranın mərkəzində sabitdir, xəritə altında sürüşdürülür.
  - GPS mövqeyindən uzaqlaşanda mənbə "xəritədən" olur.
  - Dəqiqlik 150 m-dən pis olanda (Wi-Fi və ya IP üzrə yer) "təxmini yer — dəqiqləşdirin" xəbərdarlığı göstərilir.
- **Ünvan:** Nominatim reverse geocoding server proksisindən keçir (User-Agent, saniyədə 1 sorğu növbəsi, DB keşi). Uzun adlar qısaldılır ("prospekti" → "pr."). Saxlanılan ünvanı server özü təyin edir, müştərinin göndərdiyi mətnə etibar edilmir.
- **Rate limit:** cihaz üzrə saatda 20 bildiriş.
  - Əvvəlcə ucuz yoxlama aparılır ki, limitə çatmış cihazın faylları boş yerə emal olunmasın.
  - Sonra tranzaksiya daxilində `pg_advisory_xact_lock` ilə dəqiq yoxlama olur, paralel sorğular limiti keçə bilmir.
- **Yükləmə XHR ilə edilir**, çünki `fetch` yükləmə proqresini vermir. Faiz göstərilir.
- **Telefonun "geri" düyməsi** addımlar arasında işləyir (history.pushState).

## 2026-10-06 — Mərhələ 2: xəritə və lent

- **Xəritə yalnız görünən ərazini yükləyir:**
  - `moveend` hadisəsindən 250 ms sonra bbox sorğusu (`location && ST_MakeEnvelope`, GIST indeksi) göndərilir.
  - Köhnə sorğu `AbortController` ilə ləğv olunur.
  - Pinlər diff ilə yenilənir, hamısı yenidən yaradılmır.
- **Clustering:** `leaflet.markercluster`, dizayn rəngində öz klaster ikonu ilə. Arxivdəki bildirişlər 30 gün ərzində solğun pin kimi görünür, sonra xəritədən çıxır.
- **"Yaxınlıqdakı son dəyişikliklər" paneli:** istifadəçinin yeri məlumdursa onun ətrafında, deyilsə xəritə mərkəzinin ətrafında 3 km radius götürülür. "N yeni" son 24 saatdakı bildirişləri sayır.
- **Lent:** kursorla səhifələmə (offset yoxdur, sonsuz scroll sabit qalır). 3 sıralama var:
  - Ən yeni: `created_at` + `id`.
  - Ən çox təsdiqlənən: `confirm_count` + `created_at` + `id`.
  - Ən yaxın: `ST_Distance` + `id`, maksimum 50 km.
  - Kursorda vaxt mətn kimi saxlanılır, çünki JS Date mikrosaniyələri itirir.
- **Masaüstü** (dizayn 11): başlıq, sol panel (lent + sıralama) və xəritə. Pin seçiləndə popup kart açılır. Mobildə alt panel toxunuşla genişlənir.
- **Seed:** Bakıdan 25 bildiriş, yaradılmış şəkillər, real səs və şikayətlərlə. Statusları trigger-lər hesablayır: 1 arxiv, 1 gizlədilmiş (spam), bir neçə təsdiqlənmiş.
- **Yer:** GPS icazəsi artıq verilibsə, avtomatik götürülür. Verilməyibsə, istifadəçi düyməyə basana qədər soruşulmur. Son mövqe localStorage-da saxlanılır ki, xəritə dərhal düzgün yerdə açılsın.

## 2026-10-06 — Mərhələ 1: qurulum, sxem, migration-lar, admin girişi

### Məhsul qərarları (sifarişçi ilə razılaşdırılıb)
- **İstifadəçi hesabı yoxdur.** Hamı qonaq kimi işləyir. "Mənim bildirişlərim", profil, giriş üsulu yoxdur.
- **Cihaz identifikatoru:** hər brauzerə imzalı (HMAC-SHA256) `yx_did` cookie-si verilir (httpOnly, 2 il). Bunlar ona bağlıdır:
  - rate limit (saatda 20 bildiriş),
  - "bir bildirişə bir səs",
  - "öz bildirişinə səs vermək/şikayət etmək olmaz",
  - admin tərəfindən bloklama.
  İmza olduğu üçün başqa cihazın id-sini saxtalaşdırmaq olmur. Cookie-ni silən cihaz yeni id alır. Bu, qonaq modelinin qəbul olunmuş məhdudiyyətidir. Lazım gəlsə, sonra IP üzrə əlavə limit qoyula bilər.
- **Həddlər:** 3 təsdiq → "Təsdiqlənib", 3 "aktual deyil" → arxiv (solğun), 3 şikayət → avtomatik gizlədilir. Dəyərlər `.env`-də saxlanılır və hər migrate zamanı `app_settings` cədvəlinə yazılır.
- **Admin:** yalnız login/parol (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, default `admin`/`admin`). Uğurlu girişdən sonra 12 saatlıq JWT cookie verilir. IP başına 10 dəqiqədə 10 uğursuz cəhd limiti var.

### Texniki qərarlar
- **Next.js 15 (App Router) + TypeScript + Tailwind v4.** Backend də Next.js route handler-ləridir, ayrıca server yoxdur.
- **Postgres 16 + PostGIS 3.4**, ORM olaraq **Drizzle**. Migration-lar əl ilə SQL yazılır (`drizzle/*.sql`), çünki PostGIS tipləri və trigger-lər lazımdır. Onları `scripts/migrate.mjs` tətbiq edir, konteyner hər başlananda da işləyir.
- **Biznes qaydaları DB trigger-lərindədir:**
  - öz bildirişinə səs/şikayət qadağası,
  - sayğacların artırılması,
  - statusun həddlərə görə hesablanması.
  Belə olanda paralel sorğularda da qaydalar pozulmur, `(report_id, device_id)` PK-ları təkrar səsə imkan vermir.
- Admin bərpa etdikdən sonra `moderation_locked = true` olur, yeni şikayətlər bildirişi yenidən avtomatik gizlətmir.
- **MinIO əvəzinə disk storage (plandan dəyişiklik).** MinIO community Docker image-ları artıq yenilənmir. Media faylları Docker volume-da saxlanılır, production-da Caddy tərəfindən birbaşa `/media/*` ünvanından verilir. Daha az konteyner, daha sadə backup. Lazım olsa, sonra S3-ə keçmək üçün storage qatı ayrıca modul kimi yazılacaq.
- **Caddy** HTTPS-i avtomatik verir (Let's Encrypt). Kamera, GPS və push yalnız HTTPS-də işləyir.
- **Tema:** `<html data-theme>` atributu ilə idarə olunur. İlk render-dən əvvəl inline skript sistem ayarını və ya seçimi (localStorage) tətbiq edir, ağ yanıb-sönmə olmur.
- **Dizayn tokenləri** `design/YolXeber.dc.html`-dən CSS dəyişənlərinə köçürülüb (`src/app/globals.css`), kateqoriya rəngləri `src/lib/categories.ts`-dədir.
- Dizaynda **bildiriş başlığı** (məs. "Yeni sürət kamerası") var, amma 3-cü addımda başlıq sahəsi yoxdur. Başlıq qeydin ilk cümləsindən götürülür, qeyd yoxdursa kateqoriya adı göstərilir.
