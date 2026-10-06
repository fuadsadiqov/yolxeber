import "server-only";
import type { Fragment } from "postgres";
import { pg as sql } from "@/lib/db";
import type { CategoryKey } from "@/lib/categories";
import { reportTitle } from "@/lib/format";
import { mediaUrl } from "@/lib/media-url";
import type {
  FeedPage,
  FeedSort,
  LatLng,
  MapReport,
  MediaItem,
  NearbySummary,
  ReportCard,
  ReportDetail,
  ReportStatus,
  VoteKind,
} from "@/lib/types";

/** Arxivə düşmüş bildirişlər xəritədə bu qədər gün solğun görünür, sonra itir. */
const OUTDATED_VISIBLE_DAYS = 30;
/** "Ən yaxın" sıralaması üçün maksimum məsafə */
const NEAR_MAX_M = 50_000;

const point = (p: LatLng) => sql`ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography`;

type CardRow = {
  id: string;
  category: CategoryKey;
  status: ReportStatus;
  note: string;
  address: string | null;
  locality: string | null;
  lat: number;
  lng: number;
  confirm_count: number;
  outdated_count: number;
  created_at: Date;
  created_cursor: string;
  distance_m: number | null;
  thumb_key: string | null;
  first_key: string | null;
  first_kind: "image" | "video" | null;
  media_count: number;
  has_video: boolean;
};

// Lent kartı üçün sütunlar + birinci medianın miniatürü.
// created_cursor: mikrosaniyə dəqiqliyini itirməmək üçün mətn kimi (JS Date yalnız ms saxlayır).
function cardSelect(pt: Fragment | null) {
  return sql`
    SELECT r.id, r.category, r.status, r.note, r.address, r.locality,
           ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng,
           r.confirm_count, r.outdated_count, r.created_at, r.created_at::text AS created_cursor,
           ${pt ? sql`ST_Distance(r.location, ${pt})` : sql`NULL::float8`} AS distance_m,
           m.thumb_key, m.storage_key AS first_key, m.kind AS first_kind,
           COALESCE(mc.cnt, 0) AS media_count, COALESCE(mc.has_video, false) AS has_video
    FROM reports r
    LEFT JOIN LATERAL (
      SELECT thumb_key, storage_key, kind FROM report_media WHERE report_id = r.id ORDER BY position LIMIT 1
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS cnt, bool_or(kind = 'video') AS has_video FROM report_media WHERE report_id = r.id
    ) mc ON true`;
}

function toCard(r: CardRow): ReportCard {
  const thumb = r.thumb_key ?? (r.first_kind === "image" ? r.first_key : null);
  return {
    id: r.id,
    category: r.category,
    status: r.status,
    lat: Number(r.lat),
    lng: Number(r.lng),
    title: reportTitle(r.note, r.category),
    note: r.note,
    address: r.address,
    locality: r.locality,
    distanceM: r.distance_m == null ? null : Number(r.distance_m),
    confirmCount: r.confirm_count,
    outdatedCount: r.outdated_count,
    createdAt: r.created_at.toISOString(),
    thumbUrl: thumb ? mediaUrl(thumb) : null,
    mediaCount: r.media_count,
    hasVideo: r.has_video,
  };
}

/** Xəritənin görünən ərazisindəki bildirişlər (yalnız pin üçün lazım olan sahələr). */
export async function reportsInBbox(b: { west: number; south: number; east: number; north: number }, limit = 600) {
  const rows = await sql<
    { id: string; category: CategoryKey; status: ReportStatus; note: string; lat: number; lng: number; created_at: Date }[]
  >`
    SELECT r.id, r.category, r.status, r.note,
           ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng, r.created_at
    FROM reports r
    WHERE r.location && ST_MakeEnvelope(${b.west}::float8, ${b.south}::float8, ${b.east}::float8, ${b.north}::float8, 4326)::geography
      AND (r.status IN ('active', 'verified')
           OR (r.status = 'outdated' AND r.status_changed_at > now() - make_interval(days => ${OUTDATED_VISIBLE_DAYS})))
    ORDER BY r.created_at DESC
    LIMIT ${limit}`;
  return rows.map(
    (r): MapReport => ({
      id: r.id,
      category: r.category,
      status: r.status,
      lat: Number(r.lat),
      lng: Number(r.lng),
      title: reportTitle(r.note, r.category),
      createdAt: r.created_at.toISOString(),
    }),
  );
}

/** "Yaxınlıqdakı son dəyişikliklər" paneli */
export async function nearbySummary(p: LatLng, radiusM = 3000, limit = 10): Promise<NearbySummary> {
  const pt = point(p);
  const [rows, [count]] = await Promise.all([
    sql<CardRow[]>`
      ${cardSelect(pt)}
      WHERE r.status IN ('active', 'verified') AND ST_DWithin(r.location, ${pt}, ${radiusM}::float8)
      ORDER BY r.created_at DESC
      LIMIT ${limit}`,
    sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM reports r
      WHERE r.status IN ('active', 'verified') AND ST_DWithin(r.location, ${pt}, ${radiusM}::float8)
        AND r.created_at > now() - interval '24 hours'`,
  ]);
  return { items: rows.map(toCard), newCount: count.n, radiusM };
}

// Kursor — son elementin sıralama açarları (base64url JSON).
const encodeCursor = (v: unknown[]) => Buffer.from(JSON.stringify(v)).toString("base64url");
function decodeCursor(c: string | null | undefined): unknown[] | null {
  if (!c) return null;
  try {
    const v = JSON.parse(Buffer.from(c, "base64url").toString());
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Lent: sonsuz scroll üçün kursorla səhifələmə. "near" üçün istifadəçinin yeri lazımdır. */
export async function feed(opts: { sort: FeedSort; at: LatLng | null; cursor?: string | null; limit?: number }): Promise<FeedPage> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const c = decodeCursor(opts.cursor);
  const pt = opts.at ? point(opts.at) : null;
  const base = sql`${cardSelect(pt)} WHERE r.status IN ('active', 'verified')`;

  let rows: CardRow[];
  if (opts.sort === "near" && pt) {
    rows = await sql<CardRow[]>`
      ${base} AND ST_DWithin(r.location, ${pt}, ${NEAR_MAX_M}::float8)
      ${c ? sql`AND (ST_Distance(r.location, ${pt}), r.id) > (${Number(c[0])}::float8, ${String(c[1])}::uuid)` : sql``}
      ORDER BY ST_Distance(r.location, ${pt}), r.id
      LIMIT ${limit + 1}`;
  } else if (opts.sort === "top") {
    rows = await sql<CardRow[]>`
      ${base}
      ${c ? sql`AND (r.confirm_count, r.created_at, r.id) < (${Number(c[0])}::int, ${String(c[1])}::timestamptz, ${String(c[2])}::uuid)` : sql``}
      ORDER BY r.confirm_count DESC, r.created_at DESC, r.id DESC
      LIMIT ${limit + 1}`;
  } else {
    rows = await sql<CardRow[]>`
      ${base}
      ${c ? sql`AND (r.created_at, r.id) < (${String(c[0])}::timestamptz, ${String(c[1])}::uuid)` : sql``}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ${limit + 1}`;
  }

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && last) {
    nextCursor =
      opts.sort === "near" && pt
        ? encodeCursor([last.distance_m, last.id])
        : opts.sort === "top"
          ? encodeCursor([last.confirm_count, last.created_cursor, last.id])
          : encodeCursor([last.created_cursor, last.id]);
  }
  return { items: page.map(toCard), nextCursor };
}

/**
 * Detal səhifəsi. Gizlədilmiş/silinmiş bildirişlər ictimaiyyətə göstərilmir (null).
 * deviceId — cari cihazın səsini və "öz bildirişi"ni müəyyən etmək üçün.
 */
export async function reportDetail(id: string, deviceId: string | null, at: LatLng | null = null): Promise<ReportDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const pt = at ? point(at) : null;
  const [row] = await sql<(CardRow & { device_id: string })[]>`
    SELECT x.*, r2.device_id FROM (${cardSelect(pt)} WHERE r.id = ${id}::uuid AND r.status NOT IN ('hidden', 'deleted')) x
    JOIN reports r2 ON r2.id = x.id`;
  if (!row) return null;

  const [media, mine] = await Promise.all([
    sql<{ id: string; kind: "image" | "video"; storage_key: string; thumb_key: string | null; width: number | null; height: number | null }[]>`
      SELECT id, kind, storage_key, thumb_key, width, height FROM report_media WHERE report_id = ${id}::uuid ORDER BY position`,
    deviceId
      ? sql<{ vote: VoteKind | null; flagged: boolean }[]>`
          SELECT (SELECT kind FROM votes WHERE report_id = ${id}::uuid AND device_id = ${deviceId}::uuid) AS vote,
                 EXISTS (SELECT 1 FROM flags WHERE report_id = ${id}::uuid AND device_id = ${deviceId}::uuid) AS flagged`
      : Promise.resolve([{ vote: null, flagged: false }]),
  ]);

  return {
    ...toCard(row),
    media: media.map(
      (m): MediaItem => ({
        id: m.id,
        kind: m.kind,
        url: mediaUrl(m.storage_key),
        thumbUrl: m.thumb_key ? mediaUrl(m.thumb_key) : null,
        width: m.width,
        height: m.height,
      }),
    ),
    myVote: mine[0]?.vote ?? null,
    myFlagged: mine[0]?.flagged ?? false,
    isOwn: deviceId === row.device_id,
  };
}

export class ReportActionError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

/** Postgres xətalarını (unikal açar, trigger, FK) API xəta kodlarına çevirir. */
function mapPgError(e: unknown, duplicateCode: string): never {
  const err = e as { code?: string; message?: string };
  if (err.code === "23505") throw new ReportActionError(duplicateCode, 409);
  if (err.code === "P0001" && err.message === "own_report") throw new ReportActionError("own_report", 403);
  if (err.code === "23503") throw new ReportActionError("not_found", 404);
  throw e;
}

async function assertVisible(id: string) {
  const [r] = await sql`SELECT 1 FROM reports WHERE id = ${id}::uuid AND status NOT IN ('hidden', 'deleted')`;
  if (!r) throw new ReportActionError("not_found", 404);
}

/** Səs vermə. Təkrar səs, öz bildirişinə səs — DB səviyyəsində bloklanır. */
export async function castVote(id: string, deviceId: string, kind: VoteKind) {
  await assertVisible(id);
  try {
    await sql`INSERT INTO votes (report_id, device_id, kind) VALUES (${id}::uuid, ${deviceId}::uuid, ${kind})`;
  } catch (e) {
    mapPgError(e, "already_voted");
  }
  const [r] = await sql<{ status: ReportStatus; confirm_count: number; outdated_count: number }[]>`
    SELECT status, confirm_count, outdated_count FROM reports WHERE id = ${id}::uuid`;
  return { status: r.status, confirmCount: r.confirm_count, outdatedCount: r.outdated_count };
}

export async function flagReport(id: string, deviceId: string, reason: string, comment: string | null) {
  await assertVisible(id);
  try {
    await sql`INSERT INTO flags (report_id, device_id, reason, comment)
              VALUES (${id}::uuid, ${deviceId}::uuid, ${reason}, ${comment})`;
  } catch (e) {
    mapPgError(e, "already_flagged");
  }
}
