import type { Metadata } from "next";
import { OfflineRetry } from "./OfflineRetry";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Oflayn" };

// Service worker şəbəkə olmayanda keşdə olmayan səhifələr üçün bunu göstərir (dizayn 10).
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <span className="mb-5 flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full bg-surface p-[1.4375rem] text-danger shadow-[0_0_0_10px_var(--danger-soft)]">
        <Icon name="wifiOff" />
      </span>
      <h1 className="mb-2 text-[1.3125rem] font-bold">İnternet bağlantısı yoxdur</h1>
      <p className="mb-6 text-[0.9375rem] leading-normal text-pretty text-muted">
        Bağlantını yoxlayıb yenidən cəhd edin. Əvvəl baxdığınız xəritə və lent oflayn açılır.
      </p>
      <OfflineRetry />
    </main>
  );
}
