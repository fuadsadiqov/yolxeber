# Dəyişikliklər

Bütün əhəmiyyətli dəyişikliklər burada qeyd olunur. Format [Keep a Changelog](https://keepachangelog.com/) əsaslıdır, versiyalar [Semantic Versioning](https://semver.org/) qaydasına uyğundur:

- **MAJOR** (2.0.0): köhnə versiya ilə uyğunsuz dəyişiklik (məs. geri qaytarılmayan DB dəyişikliyi, API-nin pozulması);
- **MINOR** (1.1.0): yeni funksiya;
- **PATCH** (1.0.1): xəta düzəlişi, kiçik görünüş dəyişikliyi.

Texniki qərarların səbəbləri: [DECISIONS.md](DECISIONS.md).

## [Buraxılmamış]

## [1.2.0] — 2026-10-07

### Əlavə olundu
- Google Analytics 4 statistikası (`G-C53R01SXJH`): səhifə baxışları, sessiya müddəti, cihazlar, mənbələr. Yalnız production-da yüklənir, admin panel izlənmir.
- Əsas əməliyyatlar üçün hadisələr: `report_created`, `report_edited`, `vote`, `report_flagged`, `comment_posted`, `push_enabled`, `app_installed`, `open_external_map`, `share`.

## [1.1.1] — 2026-10-07

### Dəyişdi
- Alt menyudakı mərkəzi "Bildir" düyməsi böyüdüldü (~22%) və yumru edildi, menyudan bir az daha yuxarı qalxır.

## [1.1.0] — 2026-10-07

### Əlavə olundu
- Yeni kateqoriya: **"Hərəkət istiqaməti dəyişib"** (məs. küçə birtərəfli edilib, istiqamət tərsinə çevrilib). Əks istiqamətli oxlar ikonu, bənövşəyi rəng.

## [1.0.1] — 2026-10-07

### Düzəldildi
- Mobildə "Tətbiqi yüklə" (iPhone təlimatı) və digər alt panellər aşağıdakı menyunun (TabBar) altında qalırdı. Panellər indi həmişə ən üstdə açılır.

### Dəyişdi
- Tam ekran şəkil baxışı şəklin kənarındakı qara sahəyə toxunanda bağlanır.

## [1.0.0] — 2026-10-07

İlk versiyalaşdırılmış buraxılış.

### Əlavə olundu
- Xəritə: kateqoriya rəngli pinlər, qruplaşdırma (cluster), yalnız görünən ərazinin yüklənməsi, "Yaxınlıqdakı son dəyişikliklər" paneli, masaüstü görünüş.
- Lent: "Ən yeni / Ən yaxın / Ən çox təsdiqlənən" sıralaması, sonsuz scroll, oflayn vəziyyət.
- Bildiriş əlavə etmə (3 addım): kamera və qalereya, brauzerdə şəkil sıxışdırma, video limiti (30 san / 50 MB), GPS və sürüşdürülən pin, ünvanı əl ilə yazmaq və axtarmaq.
- 8 kateqoriya, o cümlədən "Stop nişanının tələbi pozulması".
- Bildiriş detalı:
  - tam ekran şəkil baxışı;
  - başlıqdan sonra təsvir, sonra xəritə;
  - Google Maps / Waze / Apple / Yandex-də açmaq;
  - "Mən də gördüm" / "Artıq aktual deyil", şikayət, paylaşma;
  - rəylər.
- Müəllif öz bildirişini eyni formada düzəldə bilir. Əsaslı dəyişiklikdə (kateqoriya dəyişərsə və ya yer 150 m-dən çox sürüşərsə) səslər sıfırlanır.
- Push bildirişləri: hər yeni bildiriş abunə olan bütün cihazlara göndərilir. Test bildirişi düyməsi var.
- PWA: oflayn rejim, "Ana ekrana əlavə et" düyməsi, ilk girişdə təklif pəncərəsi (imtina edilsə 3 gün sonra yenidən çıxır).
- Etibarlılıq: 3 təsdiq → "Təsdiqlənib", 3 "aktual deyil" → arxiv, 3 şikayət → gizlədilir. Cihaz üzrə rate limit.
- Admin panel: gizlədilmiş və şikayət olunmuş bildirişlər və rəylər, bərpa, silmə, cihaz bloklama.
- Açıq və tünd tema, Poppins şrifti, Azərbaycan dilində interfeys.
- Docker deploy: PostGIS, app, mövcud reverse proxy ilə inteqrasiya.

[Buraxılmamış]: https://github.com/fuadsadiqov/yolxeber/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/fuadsadiqov/yolxeber/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/fuadsadiqov/yolxeber/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/fuadsadiqov/yolxeber/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/fuadsadiqov/yolxeber/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fuadsadiqov/yolxeber/releases/tag/v1.0.0
