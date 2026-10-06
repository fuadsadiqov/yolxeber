import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Dev rejimində HMR hər dəfə yeni pool açmasın deyə bağlantını global-da saxlayırıq.
const g = globalThis as unknown as { __yxSql?: postgres.Sql };
export const pg = g.__yxSql ?? postgres(env.DATABASE_URL, { max: 10 });
if (process.env.NODE_ENV !== "production") g.__yxSql = pg;

export const db = drizzle(pg, { schema });
export { schema };
