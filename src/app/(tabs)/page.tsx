import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MapScreen } from "./MapScreen";

// Xəritə ekranı: mobil — tam ekran xəritə + alt panel; masaüstü — başlıq, sol panel (lent), xəritə.
export default function MapPage() {
  return (
    <main className="fixed inset-0 flex flex-col bg-map-bg">
      <AppHeader />
      <Suspense>
        <MapScreen />
      </Suspense>
    </main>
  );
}
