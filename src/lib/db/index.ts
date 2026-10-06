import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Dev rejimində HMR hər dəfə yeni pool açmasın deyə bağlantını global-da saxlayırıq.
const g = globalThis as unknown as { __yxSql?: postgres.Sql; __yxDrizzleSql?: postgres.Sql };
export const pg = g.__yxSql ?? postgres(env.DATABASE_URL, { max: 10 });
// Drizzle ötürülən klientin tarix parser-lərini əvəz edir (timestamptz → string). Xam `pg` sorğuları
// Date gözlədiyi üçün drizzle-a ayrıca kiçik pool veririk.
const drizzleSql = g.__yxDrizzleSql ?? postgres(env.DATABASE_URL, { max: 3 });
if (process.env.NODE_ENV !== "production") Object.assign(g, { __yxSql: pg, __yxDrizzleSql: drizzleSql });

export const db = drizzle(drizzleSql, { schema });
export { schema };
