import "server-only";
import { z } from "zod";

// Server tərəfdə istifadə olunan bütün mühit dəyişənləri bir yerdə yoxlanılır.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DEVICE_SECRET: z.string().min(32, "DEVICE_SECRET ən azı 32 simvol olmalıdır"),

  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1).default("admin"),
  ADMIN_JWT_SECRET: z.string().min(32, "ADMIN_JWT_SECRET ən azı 32 simvol olmalıdır"),

  // Saytın ictimai ünvanı — paylaşma önizləmələrində (OG) tam URL üçün. Məs.: https://yolxeber.tekerizm.com
  SITE_URL: z.string().url().optional(),

  // Media faylları diskdə (Docker volume) saxlanılır və /media/... ünvanından verilir.
  MEDIA_DIR: z.string().default("./data/media"),

  NOMINATIM_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  // Nominatim tətbiqi tanıya bilməlidir; "example.com" kimi nümunə dəyərləri 403 ilə bloklayır.
  NOMINATIM_USER_AGENT: z.string().default("YolXeber/1.0 (+https://github.com/fuadsadiqov/yolxeber)"),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
});

// `next build` zamanı (Docker image qurularkən) .env yoxdur — o mərhələdə yoxlamanı ötürürük,
// real yoxlama server işə düşəndə olur.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
export const env = isBuild ? (process.env as unknown as z.infer<typeof schema>) : schema.parse(process.env);
