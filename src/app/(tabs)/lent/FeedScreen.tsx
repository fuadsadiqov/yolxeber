"use client";

import { useEffect, useState } from "react";
import { TopActions } from "@/components/layout/AppHeader";
import { FeedList } from "@/components/feed/FeedList";
import { Segmented, SORT_OPTIONS } from "@/components/report/bits";
import { useToast } from "@/components/ui/Toast";
import { useGeo } from "@/lib/client/geo";
import { useLocality } from "@/lib/client/useLocality";
import type { FeedSort } from "@/lib/types";

const SORT_KEY = "yx-feed-sort";

export function FeedScreen() {
  const { position, status, locate } = useGeo();
  const [sort, setSort] = useState<FeedSort>("new");
  const locality = useLocality(position);
  const toast = useToast();

  useEffect(() => {
    try {
      const s = localStorage.getItem(SORT_KEY) as FeedSort | null;
      if (s === "new" || s === "near" || s === "top") setSort(s);
    } catch {}
  }, []);

  const change = async (s: FeedSort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {}
    if (s === "near" && !position) {
      const fix = await locate();
      if (!fix)
        toast("Yer məlumatına icazə verilməyib", {
          icon: "locate",
          action: { label: "İcazə ver", onClick: () => void locate() },
        });
    }
  };

  return (
    <main className="pb-tabbar mx-auto min-h-dvh max-w-2xl px-4 pt-[env(safe-area-inset-top)] md:pb-10">
      <header className="flex h-14 items-center justify-between md:mt-4">
        <h1 className="text-[28px] font-bold">Lent</h1>
        <TopActions className="md:hidden" />
      </header>
      <p className="mb-3.5 min-h-6 text-sm text-muted">
        {locality
          ? `${locality} ətrafı`
          : status === "denied"
            ? "Yer məlumatı olmadan bütün bildirişlər"
            : "Son dəyişikliklər"}
      </p>
      <div className="mb-3.5">
        <Segmented label="Sıralama" value={sort} options={SORT_OPTIONS} onChange={change} />
      </div>
      <FeedList sort={sort} at={position} />
    </main>
  );
}
