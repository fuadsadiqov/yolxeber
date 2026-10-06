import "server-only";
import { cookies } from "next/headers";
import { pg as sql } from "@/lib/db";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-session";
import { mediaUrl } from "@/lib/media-url";
import { reportTitle } from "@/lib/format";
import type { CategoryKey } from "@/lib/categories";
import type { ReportStatus } from "@/lib/types";
import { deleteReportMedia } from "@/lib/storage";

/** Middleware artıq yoxlayır; bu, əlavə müdafiə qatıdır və admin adını audit üçün qaytarır. */
export async function requireAdmin(): Promise<string> {
  const admin = await verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!admin) throw new Error("unauthorized");
  return admin;
}

export type AdminReport = {
  id: string;
  category: CategoryKey;
  status: ReportStatus;
  title: string;
  note: string;
  address: string | null;
  locality: string | null;
  createdAt: string;
  deviceId: string;
  deviceBlocked: boolean;
  confirmCount: number;
  outdatedCount: number;
  flagCount: number;
  moderationLocked: boolean;
  thumbs: string[];
  flags: { reason: string; comment: string | null; createdAt: string }[];
};

type Row = {
  id: string;
  category: CategoryKey;
  status: ReportStatus;
  note: string;
  address: string | null;
  locality: string | null;
  created_at: Date;
  device_id: string;
  blocked_at: Date | null;
  confirm_count: number;
  outdated_count: number;
  flag_count: number;
  moderation_locked: boolean;
  thumbs: string[] | null;
  flags: { reason: string; comment: string | null; created_at: string }[] | null;
};

/** tab: "hidden" (şikayətlə gizlədilənlər), "flagged" (şikayəti olan bütün), "recent" (son bildirişlər) */
export async function adminReports(tab: "hidden" | "flagged" | "recent"): Promise<AdminReport[]> {
  const where =
    tab === "hidden"
      ? sql`r.status = 'hidden'`
      : tab === "flagged"
        ? sql`r.flag_count > 0 AND r.status <> 'deleted'`
        : sql`r.status <> 'deleted'`;
  const rows = await sql<Row[]>`
    SELECT r.id, r.category, r.status, r.note, r.address, r.locality, r.created_at, r.device_id, d.blocked_at,
           r.confirm_count, r.outdated_count, r.flag_count, r.moderation_locked,
           (SELECT array_agg(COALESCE(m.thumb_key, m.storage_key) ORDER BY m.position) FROM report_media m WHERE m.report_id = r.id) AS thumbs,
           (SELECT json_agg(json_build_object('reason', f.reason, 'comment', f.comment, 'created_at', f.created_at) ORDER BY f.created_at DESC)
              FROM flags f WHERE f.report_id = r.id) AS flags
    FROM reports r
    JOIN devices d ON d.id = r.device_id
    WHERE ${where}
    ORDER BY ${tab === "recent" ? sql`r.created_at DESC` : sql`r.flag_count DESC, r.status_changed_at DESC`}
    LIMIT 100`;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    title: reportTitle(r.note, r.category),
    note: r.note,
    address: r.address,
    locality: r.locality,
    createdAt: r.created_at.toISOString(),
    deviceId: r.device_id,
    deviceBlocked: !!r.blocked_at,
    confirmCount: r.confirm_count,
    outdatedCount: r.outdated_count,
    flagCount: r.flag_count,
    moderationLocked: r.moderation_locked,
    thumbs: (r.thumbs ?? []).filter((k) => k.endsWith(".webp")).map(mediaUrl),
    flags: (r.flags ?? []).map((f) => ({ reason: f.reason, comment: f.comment, createdAt: f.created_at })),
  }));
}

export async function blockedDevices() {
  return sql<{ id: string; blocked_at: Date; block_reason: string | null; reports: number }[]>`
    SELECT d.id, d.blocked_at, d.block_reason, (SELECT count(*)::int FROM reports r WHERE r.device_id = d.id) AS reports
    FROM devices d WHERE d.blocked_at IS NOT NULL ORDER BY d.blocked_at DESC LIMIT 200`;
}

export async function adminCounts() {
  const [c] = await sql<{ hidden: number; flagged: number; blocked: number }[]>`
    SELECT (SELECT count(*)::int FROM reports WHERE status = 'hidden') AS hidden,
           (SELECT count(*)::int FROM reports WHERE flag_count > 0 AND status <> 'deleted') AS flagged,
           (SELECT count(*)::int FROM devices WHERE blocked_at IS NOT NULL) AS blocked`;
  return c;
}

async function audit(admin: string, action: string, targetType: string, targetId: string, details?: object) {
  await sql`INSERT INTO admin_actions (admin, action, target_type, target_id, details)
            VALUES (${admin}, ${action}, ${targetType}, ${targetId}, ${details ? sql.json(details as never) : null})`;
}

/**
 * Bərpa: status trigger tərəfindən sayğaclara görə yenidən hesablanır (active/verified/outdated),
 * moderation_locked=true — yeni şikayətlər onu yenidən avtomatik gizlətməsin.
 */
export async function restoreReport(admin: string, id: string) {
  const r = await sql`UPDATE reports SET status = 'active', moderation_locked = true
                      WHERE id = ${id}::uuid AND status <> 'deleted'`;
  if (r.count) await audit(admin, "restore", "report", id);
  return r.count > 0;
}

/** Silmə: soft delete (sətir qalır, audit üçün), media faylları isə diskdən silinir. */
export async function deleteReport(admin: string, id: string) {
  const r = await sql`UPDATE reports SET status = 'deleted' WHERE id = ${id}::uuid AND status <> 'deleted'`;
  if (r.count) {
    await sql`DELETE FROM report_media WHERE report_id = ${id}::uuid`;
    await deleteReportMedia(id).catch(() => {});
    await audit(admin, "delete", "report", id);
  }
  return r.count > 0;
}

/** Cihazı bloklayır; istəyə görə onun bütün aktiv bildirişlərini də gizlədir. */
export async function blockDevice(admin: string, deviceId: string, reason: string | null, hideReports: boolean) {
  const r = await sql`UPDATE devices SET blocked_at = now(), block_reason = ${reason} WHERE id = ${deviceId}::uuid`;
  if (r.count) {
    if (hideReports) {
      await sql`UPDATE reports SET status = 'hidden' WHERE device_id = ${deviceId}::uuid AND status IN ('active', 'verified', 'outdated')`;
    }
    await audit(admin, "block_device", "device", deviceId, { reason, hideReports });
  }
  return r.count > 0;
}

export async function unblockDevice(admin: string, deviceId: string) {
  const r = await sql`UPDATE devices SET blocked_at = NULL, block_reason = NULL WHERE id = ${deviceId}::uuid`;
  if (r.count) await audit(admin, "unblock_device", "device", deviceId);
  return r.count > 0;
}
