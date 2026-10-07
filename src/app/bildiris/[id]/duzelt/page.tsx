import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDeviceId } from "@/lib/device";
import { reportDetail } from "@/lib/reports";
import { EditReport } from "./EditReport";

export const metadata: Metadata = { title: "Bildirişi düzəlt", robots: { index: false } };

/** Müəllifin öz bildirişini redaktə etməsi — yaratma ilə eyni 3 addımlı forma */
export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await reportDetail(id, await getDeviceId());
  if (!r) notFound();
  if (!r.isOwn) redirect(`/bildiris/${id}`);
  return (
    <EditReport
      id={r.id}
      category={r.category}
      note={r.note}
      lat={r.lat}
      lng={r.lng}
      address={r.address}
      locality={r.locality}
      createdAt={r.createdAt}
      media={r.media}
    />
  );
}
