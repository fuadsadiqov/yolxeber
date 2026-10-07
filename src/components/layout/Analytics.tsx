"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { analyticsEnabled, GA_ID } from "@/lib/client/analytics";

/**
 * Google Analytics 4. Səhifə keçidləri (SPA) GA4-ün "enhanced measurement" funksiyası ilə avtomatik izlənir,
 * vaxt/sessiya statistikası da oradan gəlir. Admin panel izlənmir.
 */
export function Analytics() {
  const path = usePathname();
  // Yalnız ilk açılış yoxlanılır: skript bir dəfə yüklənir
  const [skip] = useState(() => path.startsWith("/admin"));
  if (!analyticsEnabled || skip) return null;
  return <GoogleAnalytics gaId={GA_ID} />;
}
