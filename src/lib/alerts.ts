import "server-only";
import { z } from "zod";
import { pg as sql } from "@/lib/db";
import { CATEGORY_KEYS, type CategoryKey } from "@/lib/categories";
import type { AlertZone } from "@/lib/types";

/** Bir cihaz üçün maksimum zona sayı */
export const MAX_ZONES = 10;

export const zoneInput = z.object({
  name: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(300).max(20000),
  categories: z.array(z.enum(CATEGORY_KEYS)).min(1),
  enabled: z.boolean().default(true),
});

type Row = { id: string; name: string; lat: number; lng: number; radius_m: number; categories: string; enabled: boolean };

// postgres.js enum massivini "{a,b}" sətri kimi qaytara bilər — hər iki halı qəbul edirik.
const parseArr = (v: unknown): CategoryKey[] =>
  (Array.isArray(v) ? v : String(v).replace(/^\{|\}$/g, "").split(",")).filter(Boolean) as CategoryKey[];

const toZone = (r: Row): AlertZone => ({
  id: r.id,
  name: r.name,
  lat: Number(r.lat),
  lng: Number(r.lng),
  radiusM: r.radius_m,
  categories: parseArr(r.categories),
  enabled: r.enabled,
});

const select = () => sql`SELECT id, name, ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng, radius_m, categories::text[] AS categories, enabled FROM alert_zones`;

export async function listZones(deviceId: string) {
  const rows = await sql<Row[]>`${select()} WHERE device_id = ${deviceId}::uuid ORDER BY created_at`;
  return rows.map(toZone);
}

export async function createZone(deviceId: string, z: z.infer<typeof zoneInput>) {
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM alert_zones WHERE device_id = ${deviceId}::uuid`;
  if (n >= MAX_ZONES) return null;
  const [row] = await sql<Row[]>`
    WITH ins AS (
      INSERT INTO alert_zones (device_id, name, center, radius_m, categories, enabled)
      VALUES (${deviceId}::uuid, ${z.name}, ST_SetSRID(ST_MakePoint(${z.lng}::float8, ${z.lat}::float8), 4326)::geography,
              ${z.radiusM}, ${sql.array(z.categories)}::text[]::report_category[], ${z.enabled})
      RETURNING *)
    SELECT id, name, ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng, radius_m, categories::text[] AS categories, enabled FROM ins`;
  return toZone(row);
}

export async function updateZone(deviceId: string, id: string, z: z.infer<typeof zoneInput>) {
  const [row] = await sql<Row[]>`
    WITH up AS (
      UPDATE alert_zones SET
        name = ${z.name},
        center = ST_SetSRID(ST_MakePoint(${z.lng}::float8, ${z.lat}::float8), 4326)::geography,
        radius_m = ${z.radiusM},
        categories = ${sql.array(z.categories)}::text[]::report_category[],
        enabled = ${z.enabled}
      WHERE id = ${id}::uuid AND device_id = ${deviceId}::uuid
      RETURNING *)
    SELECT id, name, ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng, radius_m, categories::text[] AS categories, enabled FROM up`;
  return row ? toZone(row) : null;
}

export async function deleteZone(deviceId: string, id: string) {
  const r = await sql`DELETE FROM alert_zones WHERE id = ${id}::uuid AND device_id = ${deviceId}::uuid`;
  return r.count > 0;
}
