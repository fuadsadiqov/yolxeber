import { customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type LngLat = { lng: number; lat: number };

/**
 * PostGIS `geography(Point,4326)` sütunu.
 * Postgres nöqtəni EWKB hex kimi qaytarır — burada onu {lng, lat}-a çeviririk.
 */
export const geographyPoint = customType<{ data: LngLat; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver(v) {
    return sql`ST_SetSRID(ST_MakePoint(${v.lng}, ${v.lat}), 4326)::geography` as unknown as string;
  },
  fromDriver(hex) {
    return parseEwkbPoint(hex);
  },
});

/** EWKB point: [byteOrder:1][type:4][srid:4 (bayraq varsa)][x:8][y:8] */
export function parseEwkbPoint(hex: string): LngLat {
  const buf = Buffer.from(hex, "hex");
  const le = buf[0] === 1;
  const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const hasSrid = (type & 0x20000000) !== 0;
  const off = hasSrid ? 9 : 5;
  const x = le ? buf.readDoubleLE(off) : buf.readDoubleBE(off);
  const y = le ? buf.readDoubleLE(off + 8) : buf.readDoubleBE(off + 8);
  return { lng: x, lat: y };
}
