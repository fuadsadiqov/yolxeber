"use client";

import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

export function OfflineRetry() {
  // Bağlantı bərpa olunanda avtomatik yenilə
  useEffect(() => {
    const on = () => location.reload();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-7 text-base font-bold text-white"
    >
      <span className="h-5 w-5">
        <Icon name="refresh" />
      </span>
      Yenidən cəhd et
    </button>
  );
}
