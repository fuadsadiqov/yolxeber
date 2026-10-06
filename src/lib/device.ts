import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DEVICE_HEADER } from "@/lib/device-token";

export class DeviceBlockedError extends Error {
  constructor() {
    super("device_blocked");
  }
}

/** Middleware-in yoxladığı cihaz id-si. Middleware hər sorğuda təyin etdiyi üçün həmişə mövcuddur. */
export async function getDeviceId(): Promise<string> {
  const id = (await headers()).get(DEVICE_HEADER);
  if (!id) throw new Error("Cihaz id-si yoxdur — middleware işləmədi?");
  return id;
}

/**
 * Yazma əməliyyatlarından (bildiriş, səs, şikayət) əvvəl çağırılır:
 * cihazı DB-də qeyd edir (ilk dəfədirsə) və bloklanıbsa xəta atır.
 */
export async function requireActiveDevice(): Promise<string> {
  const id = await getDeviceId();
  const [row] = await db
    .insert(schema.devices)
    .values({ id })
    .onConflictDoUpdate({ target: schema.devices.id, set: { lastSeenAt: sql`now()` } })
    .returning({ blockedAt: schema.devices.blockedAt });
  if (row?.blockedAt) throw new DeviceBlockedError();
  return id;
}
