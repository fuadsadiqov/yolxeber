import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { AlertsScreen } from "./AlertsScreen";

export const metadata: Metadata = { title: "Xəbərdarlıqlar" };

export default function AlertsPage() {
  return (
    <>
      <AppHeader />
      <AlertsScreen />
    </>
  );
}
