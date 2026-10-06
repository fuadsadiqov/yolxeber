import type { Metadata } from "next";
import { NewReportFlow } from "@/components/new-report/NewReportFlow";

export const metadata: Metadata = { title: "Yeni bildiriş" };

export default function NewReportPage() {
  return <NewReportFlow />;
}
