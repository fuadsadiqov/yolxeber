import "server-only";
import { pg as sql } from "@/lib/db";
import { ReportActionError } from "@/lib/reports";
import type { CommentItem, CommentPage } from "@/lib/types";

export const COMMENT_MAX = 500;
const PER_HOUR = 10;
const MIN_INTERVAL_S = 10;
const PAGE = 20;

type Row = {
  id: string;
  body: string;
  created_at: Date;
  created_cursor: string;
  nickname: string;
  is_author: boolean;
  is_mine: boolean;
  my_flagged: boolean;
};

const toItem = (r: Row): CommentItem => ({
  id: r.id,
  body: r.body,
  createdAt: r.created_at.toISOString(),
  nickname: r.nickname,
  isAuthor: r.is_author,
  isMine: r.is_mine,
  myFlagged: r.my_flagged,
});

/**
 * Təxəllüs hər bildiriş üçün ayrıca hesablanır (cihaz + bildiriş hash-i) —
 * eyni cihazın müxtəlif bildirişlərdəki rəyləri bir-birinə bağlanmasın.
 */
function select(deviceId: string | null) {
  return sql`
    SELECT c.id, c.body, c.created_at, c.created_at::text AS created_cursor,
           upper(substr(md5(c.device_id::text || c.report_id::text), 1, 4)) AS nickname,
           (c.device_id = r.device_id) AS is_author,
           ${deviceId ? sql`(c.device_id = ${deviceId}::uuid)` : sql`false`} AS is_mine,
           ${deviceId ? sql`EXISTS (SELECT 1 FROM comment_flags f WHERE f.comment_id = c.id AND f.device_id = ${deviceId}::uuid)` : sql`false`} AS my_flagged
    FROM comments c
    JOIN reports r ON r.id = c.report_id`;
}

async function assertReportVisible(reportId: string) {
  const [r] = await sql`SELECT 1 FROM reports WHERE id = ${reportId}::uuid AND status NOT IN ('hidden', 'deleted')`;
  if (!r) throw new ReportActionError("not_found", 404);
}

/** Yeni → köhnə, kursorla səhifələmə */
export async function listComments(reportId: string, deviceId: string | null, cursor?: string | null): Promise<CommentPage> {
  await assertReportVisible(reportId);
  let c: [string, string] | null = null;
  try {
    c = cursor ? (JSON.parse(Buffer.from(cursor, "base64url").toString()) as [string, string]) : null;
  } catch {
    c = null;
  }
  const [rows, [{ total }]] = await Promise.all([
    sql<Row[]>`
      ${select(deviceId)}
      WHERE c.report_id = ${reportId}::uuid AND NOT c.hidden
        ${c ? sql`AND (c.created_at, c.id) < (${c[0]}::timestamptz, ${c[1]}::uuid)` : sql``}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ${PAGE + 1}`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM comments WHERE report_id = ${reportId}::uuid AND NOT hidden`,
  ]);
  const page = rows.slice(0, PAGE);
  const last = page[page.length - 1];
  return {
    items: page.map(toItem),
    total,
    nextCursor: rows.length > PAGE && last ? Buffer.from(JSON.stringify([last.created_cursor, last.id])).toString("base64url") : null,
  };
}

export async function addComment(reportId: string, deviceId: string, body: string): Promise<CommentItem> {
  await assertReportVisible(reportId);
  const id = await sql.begin(async (tx) => {
    // Eyni cihazdan paralel sorğular limiti keçməsin
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"c:" + deviceId}))`;
    const [s] = await tx<{ n: number; last: Date | null }[]>`
      SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS n, max(created_at) AS last
      FROM comments WHERE device_id = ${deviceId}::uuid`;
    if (s.n >= PER_HOUR) throw new ReportActionError("comment_rate_limited", 429);
    if (s.last && Date.now() - s.last.getTime() < MIN_INTERVAL_S * 1000) throw new ReportActionError("comment_too_fast", 429);
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO comments (report_id, device_id, body) VALUES (${reportId}::uuid, ${deviceId}::uuid, ${body}) RETURNING id`;
    return row.id;
  });
  const [row] = await sql<Row[]>`${select(deviceId)} WHERE c.id = ${id}::uuid`;
  return toItem(row);
}

export async function deleteOwnComment(id: string, deviceId: string) {
  const r = await sql`DELETE FROM comments WHERE id = ${id}::uuid AND device_id = ${deviceId}::uuid`;
  if (!r.count) throw new ReportActionError("not_found", 404);
}

export async function flagComment(id: string, deviceId: string) {
  try {
    await sql`INSERT INTO comment_flags (comment_id, device_id) VALUES (${id}::uuid, ${deviceId}::uuid)`;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23505") throw new ReportActionError("already_flagged", 409);
    if (err.code === "P0001" && err.message === "own_comment") throw new ReportActionError("own_comment", 403);
    if (err.code === "23503") throw new ReportActionError("not_found", 404);
    throw e;
  }
}
