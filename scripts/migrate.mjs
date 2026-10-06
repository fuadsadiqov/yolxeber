/**
 * Sadə migration icraçısı: drizzle/*.sql fayllarını ad sırası ilə bir dəfə tətbiq edir
 * və tətbiq olunanları _migrations cədvəlində saxlayır. Sonda app_settings-i .env ilə sinxronlaşdırır.
 *
 * İstifadə: pnpm db:migrate  (konteynerdə: node scripts/migrate.mjs)
 * Plain JS-dir ki, production image-da tsx olmadan işləsin.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL təyin olunmayıb");

const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(process.cwd(), "drizzle");

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });
    console.log(`✓ ${file}`);
  }

  const num = (v, d) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
  await sql`
    UPDATE app_settings SET
      confirm_threshold  = ${num(process.env.CONFIRM_THRESHOLD, 3)},
      outdated_threshold = ${num(process.env.OUTDATED_THRESHOLD, 3)},
      flag_threshold     = ${num(process.env.FLAG_THRESHOLD, 3)},
      reports_per_hour   = ${num(process.env.REPORTS_PER_HOUR, 20)}
    WHERE id = 1`;
  console.log("✓ app_settings sinxronlaşdırıldı");
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
