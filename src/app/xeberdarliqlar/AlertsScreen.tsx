"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client/api";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/client/push";

/**
 * Bildirişlər açıqdırsa, istənilən yerdə paylaşılan hər yeni bildiriş bu cihaza push kimi gəlir
 * (öz paylaşdığınız istisna). Əraziyə görə filtr hazırda istifadə olunmur.
 */
export function AlertsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [push, setPush] = useState<PushState | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    pushState().then(setPush);
  }, []);

  async function turnOnPush() {
    try {
      setPush(await enablePush());
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Bildirişləri aktiv etmək alınmadı. Səhifəni yeniləyib yenidən cəhd edin.");
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const r = await api<{ total: number; sent: number }>("/api/push/test", { method: "POST" });
      if (r.total === 0) {
        // Serverdə abunəlik yoxdur — yenidən abunə edirik
        setPush(await enablePush());
        toast("Abunəlik yeniləndi. Testi bir daha göndərin.");
      } else if (r.sent === 0) toast("Bildiriş göndərilə bilmədi. Bildirişləri söndürüb yenidən aktiv edin.");
      else toast("Test bildirişi göndərildi — bir neçə saniyəyə gəlməlidir.", { icon: "check" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Test göndərilmədi.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex h-14 items-center gap-1 md:mt-4">
        <button
          type="button"
          onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          aria-label="Geri"
          className="-ml-3 flex h-12 w-12 items-center justify-center md:hidden"
        >
          <span className="h-6 w-6">
            <Icon name="chevL" />
          </span>
        </button>
        <h1 className="text-[1.5rem] font-bold md:text-[1.75rem]">Xəbərdarlıqlar</h1>
      </header>
      <p className="mb-4 text-[0.9375rem] leading-normal text-muted">
        Bildirişləri aktiv etsəniz, sürücülər yeni nişan, kamera və ya qayda dəyişikliyi paylaşan kimi telefonunuza xəbər gələcək.
      </p>

      <PushCard state={push} onEnable={turnOnPush} onDisable={async () => (await disablePush(), setPush("off"))} />

      {push === "on" && (
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-[0.0938rem] border-line-strong text-[0.9375rem] font-semibold disabled:opacity-60"
        >
          <span className="h-5 w-5">
            <Icon name="send" />
          </span>
          {testing ? "Göndərilir…" : "Test bildirişi göndər"}
        </button>
      )}

      <ul className="mt-6 flex flex-col gap-2.5 text-sm leading-snug text-muted">
        <li className="flex gap-2.5">
          <span className="mt-0.5 h-4 w-4 flex-none text-primary-ink">
            <Icon name="check" />
          </span>
          Hər yeni bildiriş haqqında xəbər gəlir — məsafədən asılı olmayaraq.
        </li>
        <li className="flex gap-2.5">
          <span className="mt-0.5 h-4 w-4 flex-none text-primary-ink">
            <Icon name="check" />
          </span>
          Öz paylaşdığınız bildiriş üçün xəbər gəlmir — yoxlamaq üçün başqa cihazdan paylaşın.
        </li>
        <li className="flex gap-2.5">
          <span className="mt-0.5 h-4 w-4 flex-none text-primary-ink">
            <Icon name="check" />
          </span>
          iPhone-da bildirişlər yalnız sayt “Ana ekrana əlavə et” ilə quraşdırılıb oradan açılanda işləyir (iOS 16.4+).
        </li>
      </ul>
    </main>
  );
}

function PushCard({ state, onEnable, onDisable }: { state: PushState | null; onEnable: () => void; onDisable: () => void }) {
  if (!state) return <div className="h-[4.75rem] rounded-[1.125rem] bg-surface" />;
  const box = "flex items-center gap-3 rounded-[1.125rem] px-4 py-3.5";
  if (state === "on")
    return (
      <div className={`${box} bg-success-soft text-success`}>
        <span className="h-6 w-6 flex-none">
          <Icon name="bell" />
        </span>
        <span className="flex-1 text-[0.9375rem] font-semibold">Bildirişlər bu cihazda aktivdir</span>
        <button type="button" onClick={onDisable} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">
          Söndür
        </button>
      </div>
    );
  if (state === "off")
    return (
      <div className={`${box} bg-accent-badge-bg text-accent-badge-fg`}>
        <span className="h-6 w-6 flex-none">
          <Icon name="bell" />
        </span>
        <span className="flex-1 text-[0.9375rem] font-semibold">Bildirişlər söndürülüb</span>
        <button type="button" onClick={onEnable} className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-ink">
          Aktiv et
        </button>
      </div>
    );
  const text =
    state === "denied"
      ? "Bildirişlər brauzer ayarlarında bloklanıb. Sayt ayarlarından icazə verin."
      : state === "ios-install"
        ? "iPhone-da bildiriş almaq üçün: Paylaş → “Ana ekrana əlavə et”, sonra tətbiqi ana ekrandan açın."
        : "Bu brauzer push bildirişlərini dəstəkləmir.";
  return (
    <div className={`${box} bg-line-soft text-muted`}>
      <span className="h-6 w-6 flex-none">
        <Icon name="bell" />
      </span>
      <span className="text-sm leading-snug">{text}</span>
    </div>
  );
}
