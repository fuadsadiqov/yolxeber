-- Yeni kateqoriya: "Stop nişanının tələbi pozulması".
-- PG 12+: ADD VALUE tranzaksiya daxilində işləyir (yeni dəyər eyni tranzaksiyada istifadə olunmur).
ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'stop';

-- Müəllif öz bildirişini düzəldə bilər — detalda "düzəliş edilib" göstərmək üçün
ALTER TABLE reports ADD COLUMN IF NOT EXISTS edited_at timestamptz;
