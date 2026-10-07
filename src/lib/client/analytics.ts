"use client";

import { sendGAEvent } from "@next/third-parties/google";

/** Google Analytics 4 axını (ictimai identifikator — hər səhifənin mənbəyində görünür). `.env` ilə dəyişdirilə bilər. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-C53R01SXJH";

/** Yalnız production build-də — dev/test trafiki statistikanı korlamasın */
export const analyticsEnabled = process.env.NODE_ENV === "production" && GA_ID !== "off";

/** İstifadəçinin etdiyi əsas əməliyyatlar (GA4 hadisə adları) */
export type AnalyticsEvent =
  | "report_created"
  | "report_edited"
  | "vote"
  | "report_flagged"
  | "comment_posted"
  | "push_enabled"
  | "app_installed"
  | "open_external_map"
  | "share";

/** GA4-ə hadisə göndərir; GA yüklənməyibsə (dev, bloklayıcı) heç nə etmir */
export function track(event: AnalyticsEvent, params: Record<string, string | number | boolean> = {}) {
  if (!analyticsEnabled || typeof window === "undefined" || !("dataLayer" in window)) return;
  try {
    sendGAEvent("event", event, params);
  } catch {
    /* statistika heç vaxt tətbiqi pozmamalıdır */
  }
}
