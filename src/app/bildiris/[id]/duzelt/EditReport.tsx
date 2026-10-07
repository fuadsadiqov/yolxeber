"use client";

import { NewReportFlow } from "@/components/new-report/NewReportFlow";
import type { CategoryKey } from "@/lib/categories";
import type { MediaItem } from "@/lib/types";

/** Serverdən gələn bildirişi formanın ilkin vəziyyətinə çevirir */
export function EditReport(p: {
  id: string;
  category: CategoryKey;
  note: string;
  lat: number;
  lng: number;
  address: string | null;
  locality: string | null;
  createdAt: string;
  media: MediaItem[];
}) {
  return (
    <NewReportFlow
      edit={{
        id: p.id,
        category: p.category,
        note: p.note,
        place: {
          lat: p.lat,
          lng: p.lng,
          address: p.address,
          locality: p.locality,
          source: "map",
          accuracy: null,
          // Saxlanılmış ünvan xəritə hərəkətində avtomatik ünvanla əvəzlənməsin
          addressEdited: !!p.address,
          autoAddress: p.address,
        },
        media: p.media.map((m) => ({
          id: m.id,
          existingId: m.id,
          kind: m.kind,
          blob: null,
          url: m.url,
          fileName: "",
          capturedAt: new Date(p.createdAt),
        })),
      }}
    />
  );
}
