-- Yeni kateqoriya: "Hərəkət istiqaməti dəyişib" (məs. küçə birtərəfli edilib, istiqamət tərsinə çevrilib).
ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'istiqamet';
