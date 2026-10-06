import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { CATEGORIES } from "@/lib/categories";
import { reportDetail } from "@/lib/reports";
import { ReportDetailView } from "./ReportDetailView";

// generateMetadata və səhifə eyni sorğunu bir dəfə icra etsin
const load = cache(async (id: string) => reportDetail(id, await getDeviceId()));

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).id);
  if (!r) return { title: "Bildiriş tapılmadı" };
  const cover = r.media.find((m) => m.kind === "image");
  const description = [CATEGORIES[r.category].name, r.address, r.note].filter(Boolean).join(" · ");
  return {
    metadataBase: env.SITE_URL ? new URL(env.SITE_URL) : undefined,
    title: r.title,
    description,
    openGraph: { title: r.title, description, images: cover ? [{ url: cover.url }] : undefined, type: "article" },
  };
}

export default async function ReportPage({ params }: Props) {
  const r = await load((await params).id);
  if (!r) notFound();
  return <ReportDetailView initial={r} />;
}
