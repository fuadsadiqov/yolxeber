/**
 * Drizzle sxemi — drizzle/0001_init.sql ilə eyni olmalıdır.
 * Migration-lar əl ilə SQL kimi yazılır (PostGIS və trigger-lər üçün), bu fayl yalnız tipli sorğular üçündür.
 */
import {
  bigserial,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { geographyPoint } from "./geography";

export const reportCategory = pgEnum("report_category", ["nisan", "surat", "kamera", "zolaq", "istiqamet", "donus", "park", "stop", "diger"]);
export const reportStatus = pgEnum("report_status", ["active", "verified", "outdated", "hidden", "deleted"]);
export const voteKind = pgEnum("vote_kind", ["confirm", "outdated"]);
export const mediaKind = pgEnum("media_kind", ["image", "video"]);
export const flagReason = pgEnum("flag_reason", ["wrong", "spam", "offensive", "privacy", "other"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const appSettings = pgTable("app_settings", {
  id: smallint("id").primaryKey().default(1),
  confirmThreshold: integer("confirm_threshold").notNull(),
  outdatedThreshold: integer("outdated_threshold").notNull(),
  flagThreshold: integer("flag_threshold").notNull(),
  reportsPerHour: integer("reports_per_hour").notNull(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  blockedAt: ts("blocked_at"),
  blockReason: text("block_reason"),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  category: reportCategory("category").notNull(),
  note: varchar("note", { length: 280 }).notNull().default(""),
  location: geographyPoint("location").notNull(),
  address: text("address"),
  locality: text("locality"),
  status: reportStatus("status").notNull().default("active"),
  confirmCount: integer("confirm_count").notNull().default(0),
  outdatedCount: integer("outdated_count").notNull().default(0),
  flagCount: integer("flag_count").notNull().default(0),
  moderationLocked: boolean("moderation_locked").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  statusChangedAt: ts("status_changed_at").notNull().defaultNow(),
  editedAt: ts("edited_at"),
});

export const reportMedia = pgTable("report_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  kind: mediaKind("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbKey: text("thumb_key"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  sizeBytes: integer("size_bytes").notNull(),
  position: smallint("position").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => devices.id),
    kind: voteKind("kind").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.deviceId] })],
);

export const flags = pgTable(
  "flags",
  {
    reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => devices.id),
    reason: flagReason("reason").notNull(),
    comment: varchar("comment", { length: 280 }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.deviceId] })],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSuccessAt: ts("last_success_at"),
  failureCount: integer("failure_count").notNull().default(0),
});

export const alertZones = pgTable("alert_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  center: geographyPoint("center").notNull(),
  radiusM: integer("radius_m").notNull(),
  categories: reportCategory("categories").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const geocodeCache = pgTable("geocode_cache", {
  key: text("key").primaryKey(),
  address: text("address"),
  locality: text("locality"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const adminActions = pgTable("admin_actions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  admin: text("admin").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  details: jsonb("details"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type Report = typeof reports.$inferSelect;
export type ReportCategory = (typeof reportCategory.enumValues)[number];
export type ReportStatus = (typeof reportStatus.enumValues)[number];
