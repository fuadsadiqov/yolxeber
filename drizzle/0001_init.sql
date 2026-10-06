-- YolXəbər — ilkin sxem.
-- İstifadəçi hesabı yoxdur: hər kəs "qonaq"dır və cihaz identifikatoru (device id) ilə tanınır.
-- Səs/şikayət/rate-limit qaydaları cihaza bağlıdır.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE report_category AS ENUM ('nisan', 'surat', 'kamera', 'zolaq', 'donus', 'park', 'diger');
-- active   → yeni, hələ kifayət qədər təsdiq yoxdur
-- verified → təsdiq həddini keçib ("Təsdiqlənib")
-- outdated → "Artıq aktual deyil" həddini keçib (arxiv, xəritədə solğun)
-- hidden   → şikayət həddini keçib, admin baxışını gözləyir
-- deleted  → admin tərəfindən silinib (soft delete)
CREATE TYPE report_status AS ENUM ('active', 'verified', 'outdated', 'hidden', 'deleted');
CREATE TYPE vote_kind AS ENUM ('confirm', 'outdated');
CREATE TYPE media_kind AS ENUM ('image', 'video');
CREATE TYPE flag_reason AS ENUM ('wrong', 'spam', 'offensive', 'privacy', 'other');

-- Tək sətirlik tənzimləmələr. Dəyərlər .env-dən migrate skripti ilə sinxronlaşdırılır,
-- trigger-lər buradan oxuyur.
CREATE TABLE app_settings (
  id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirm_threshold   int NOT NULL DEFAULT 3,
  outdated_threshold  int NOT NULL DEFAULT 3,
  flag_threshold      int NOT NULL DEFAULT 3,
  reports_per_hour    int NOT NULL DEFAULT 20
);
INSERT INTO app_settings (id) VALUES (1);

CREATE TABLE devices (
  id            uuid PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  blocked_at    timestamptz,
  block_reason  text
);

CREATE TABLE reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id          uuid NOT NULL REFERENCES devices(id),
  category           report_category NOT NULL,
  note               varchar(280) NOT NULL DEFAULT '',
  location           geography(Point, 4326) NOT NULL,
  address            text,            -- "Heydər Əliyev pr. 115"
  locality           text,            -- "Nərimanov r., Bakı"
  status             report_status NOT NULL DEFAULT 'active',
  confirm_count      int NOT NULL DEFAULT 0,
  outdated_count     int NOT NULL DEFAULT 0,
  flag_count         int NOT NULL DEFAULT 0,
  -- Admin bərpa etdikdən sonra yeni şikayətlər bildirişi avtomatik gizlətməsin.
  moderation_locked  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  status_changed_at  timestamptz NOT NULL DEFAULT now()
);
-- Xəritə (bbox) və "ən yaxın" sorğuları üçün
CREATE INDEX reports_location_gix ON reports USING gist (location);
-- Lent sıralamaları üçün
CREATE INDEX reports_status_created_idx ON reports (status, created_at DESC);
CREATE INDEX reports_status_confirm_idx ON reports (status, confirm_count DESC, created_at DESC);
-- Rate limit: cihazın son 1 saatdakı bildirişləri
CREATE INDEX reports_device_created_idx ON reports (device_id, created_at DESC);

CREATE TABLE report_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  kind         media_kind NOT NULL,
  storage_key  text NOT NULL,
  thumb_key    text,
  width        int,
  height       int,
  duration_ms  int,
  size_bytes   int NOT NULL,
  position     smallint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_media_report_idx ON report_media (report_id, position);

-- PK (report_id, device_id): bir cihaz bir bildirişə yalnız bir dəfə səs verir.
CREATE TABLE votes (
  report_id   uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES devices(id),
  kind        vote_kind NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, device_id)
);

CREATE TABLE flags (
  report_id   uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES devices(id),
  reason      flag_reason NOT NULL,
  comment     varchar(280),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, device_id)
);

CREATE TABLE push_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  endpoint         text NOT NULL UNIQUE,
  p256dh           text NOT NULL,
  auth             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_success_at  timestamptz,
  failure_count    int NOT NULL DEFAULT 0
);
CREATE INDEX push_subscriptions_device_idx ON push_subscriptions (device_id);

CREATE TABLE alert_zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name        varchar(60) NOT NULL,
  center      geography(Point, 4326) NOT NULL,
  radius_m    int NOT NULL CHECK (radius_m BETWEEN 300 AND 20000),
  categories  report_category[] NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Yeni bildirişə uyğun zonaları tapmaq üçün: ST_DWithin(center, loc, 20000) indeksdən istifadə edir,
-- sonra hər zonanın öz radius_m-i ilə dəqiq yoxlanılır.
CREATE INDEX alert_zones_center_gix ON alert_zones USING gist (center) WHERE enabled;
CREATE INDEX alert_zones_device_idx ON alert_zones (device_id);

-- Nominatim reverse geocoding keşi (koordinat ~11 m dəqiqliklə yuvarlaqlaşdırılır)
CREATE TABLE geocode_cache (
  key         text PRIMARY KEY,         -- "40.4093,49.8671"
  address     text,
  locality    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_actions (
  id           bigserial PRIMARY KEY,
  admin        text NOT NULL,
  action       text NOT NULL,          -- restore | delete | block_device | unblock_device
  target_type  text NOT NULL,          -- report | device
  target_id    text NOT NULL,
  details      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Trigger-lər ──────────────────────────────────────────────────────────

-- Sayğaclar dəyişəndə statusu həddlərə görə yenidən hesablayır.
CREATE FUNCTION reports_apply_thresholds() RETURNS trigger AS $$
DECLARE
  s app_settings;
BEGIN
  SELECT * INTO s FROM app_settings WHERE id = 1;

  -- hidden/deleted statusuna yalnız admin toxunur; səslər onları dəyişmir.
  IF NEW.status IN ('active', 'verified', 'outdated') THEN
    IF NEW.outdated_count >= s.outdated_threshold THEN
      NEW.status := 'outdated';
    ELSIF NEW.confirm_count >= s.confirm_threshold THEN
      NEW.status := 'verified';
    ELSE
      NEW.status := 'active';
    END IF;
  END IF;

  IF NEW.flag_count >= s.flag_threshold
     AND NOT NEW.moderation_locked
     AND NEW.status <> 'deleted' THEN
    NEW.status := 'hidden';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_thresholds_bu
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION reports_apply_thresholds();

-- Öz bildirişinə səs vermə/şikayət etmə qadağası.
CREATE FUNCTION forbid_own_report() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reports r WHERE r.id = NEW.report_id AND r.device_id = NEW.device_id) THEN
    RAISE EXCEPTION 'own_report' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER votes_forbid_own_bi BEFORE INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION forbid_own_report();
CREATE TRIGGER flags_forbid_own_bi BEFORE INSERT ON flags
  FOR EACH ROW EXECUTE FUNCTION forbid_own_report();

CREATE FUNCTION votes_bump_counts() RETURNS trigger AS $$
BEGIN
  UPDATE reports SET
    confirm_count  = confirm_count  + (NEW.kind = 'confirm')::int,
    outdated_count = outdated_count + (NEW.kind = 'outdated')::int
  WHERE id = NEW.report_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER votes_bump_ai AFTER INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION votes_bump_counts();

CREATE FUNCTION flags_bump_count() RETURNS trigger AS $$
BEGIN
  UPDATE reports SET flag_count = flag_count + 1 WHERE id = NEW.report_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flags_bump_ai AFTER INSERT ON flags
  FOR EACH ROW EXECUTE FUNCTION flags_bump_count();
