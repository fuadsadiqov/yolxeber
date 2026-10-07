-- Bildiriş rəyləri (qonaq modeli: cihaza bağlı, hər bildiriş üçün ayrıca təxəllüs).

CREATE TABLE comments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device_id          uuid NOT NULL REFERENCES devices(id),
  body               varchar(500) NOT NULL CHECK (length(btrim(body)) > 0),
  flag_count         int NOT NULL DEFAULT 0,
  hidden             boolean NOT NULL DEFAULT false,   -- şikayət həddi və ya admin
  -- Admin bərpa etdikdən sonra yeni şikayətlər rəyi yenidən avtomatik gizlətməsin
  moderation_locked  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
-- Detal səhifəsində siyahı (yeni → köhnə)
CREATE INDEX comments_report_created_idx ON comments (report_id, created_at DESC) WHERE NOT hidden;
-- Rate limit: cihazın son rəyləri
CREATE INDEX comments_device_created_idx ON comments (device_id, created_at DESC);
-- Admin: şikayət olunanlar
CREATE INDEX comments_flagged_idx ON comments (flag_count DESC, created_at DESC) WHERE flag_count > 0;

-- PK (comment_id, device_id): bir cihaz bir rəyə bir dəfə şikayət edir
CREATE TABLE comment_flags (
  comment_id  uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES devices(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, device_id)
);

-- Öz rəyinə şikayət qadağası + sayğac + həddə çatanda gizlətmə (bildirişlərlə eyni hədd)
CREATE FUNCTION comment_flags_apply() RETURNS trigger AS $$
DECLARE
  t int;
BEGIN
  IF EXISTS (SELECT 1 FROM comments c WHERE c.id = NEW.comment_id AND c.device_id = NEW.device_id) THEN
    RAISE EXCEPTION 'own_comment' USING ERRCODE = 'P0001';
  END IF;
  SELECT flag_threshold INTO t FROM app_settings WHERE id = 1;
  UPDATE comments SET
    flag_count = flag_count + 1,
    hidden = hidden OR (NOT moderation_locked AND flag_count + 1 >= t)
  WHERE id = NEW.comment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_flags_bi BEFORE INSERT ON comment_flags
  FOR EACH ROW EXECUTE FUNCTION comment_flags_apply();
