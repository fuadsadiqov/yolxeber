"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useInstall } from "@/lib/client/install";

/**
 * "Tətbiqi yüklə" düyməsi — ana ekrana əlavə etmə.
 * Android/masaüstü: sistemin quraşdırma pəncərəsi; iPhone: qısa təlimat.
 * Quraşdırılıbsa və ya brauzer dəstəkləmirsə görünmür.
 */
export function InstallButton({ variant = "icon", className = "" }: { variant?: "icon" | "pill" | "card"; className?: string }) {
  const { canPrompt, isIos, promptInstall } = useInstall();
  const toast = useToast();
  const [iosHelp, setIosHelp] = useState(false);

  if (!canPrompt && !isIos) return null;

  async function onClick() {
    if (isIos) {
      setIosHelp(true);
      return;
    }
    const r = await promptInstall();
    if (r === "accepted") toast("YolXəbər ana ekrana əlavə olunur", { icon: "check" });
  }

  const label = "Tətbiqi yüklə";
  let button: React.ReactNode;
  if (variant === "card")
    button = (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-[1.125rem] bg-surface p-3.5 text-left ${className}`}
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-soft p-2.5 text-primary-ink">
          <Icon name="download" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-bold">YolXəbər-i ana ekrana əlavə et</span>
          <span className="block text-[0.8125rem] text-muted">Tətbiq kimi açılır, bildirişlər daha etibarlı gəlir</span>
        </span>
        <span className="flex-none rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">Yüklə</span>
      </button>
    );
  else if (variant === "pill")
    button = (
      <button
        type="button"
        onClick={onClick}
        className={`flex h-11 items-center gap-1.5 rounded-xl px-3 text-[0.9375rem] font-semibold text-primary-ink hover:bg-primary-soft ${className}`}
      >
        <span className="h-5 w-5">
          <Icon name="download" />
        </span>
        {label}
      </button>
    );
  else
    button = (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-surface text-primary-ink shadow-float dark:border dark:border-line ${className}`}
      >
        <span className="h-5 w-5">
          <Icon name="download" />
        </span>
      </button>
    );

  return (
    <>
      {button}
      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Ana ekrana əlavə et">
        <IosInstallSteps />
      </Sheet>
    </>
  );
}

/** iPhone/iPad: Safari-də əl ilə əlavə etmə addımları (Apple quraşdırma API-si vermir) */
export function IosInstallSteps() {
  return (
    <>
      <ol className="flex flex-col gap-3 pb-2 text-left text-[0.9375rem]">
        <IosStep n={1} icon="share">
          Safari-də aşağıdakı <b>Paylaş</b> düyməsinə basın
        </IosStep>
        <IosStep n={2} icon="plus">
          Siyahıdan <b>“Ana ekrana əlavə et”</b> seçin
        </IosStep>
        <IosStep n={3} icon="check">
          Yuxarıda <b>“Əlavə et”</b> basın — YolXəbər ikonu ana ekranda görünəcək
        </IosStep>
      </ol>
      <p className="mt-2 text-left text-[0.8125rem] text-muted">
        Push bildirişləri iPhone-da yalnız ana ekrandan açılan tətbiqdə işləyir (iOS 16.4+).
      </p>
    </>
  );
}

function IosStep({ n, icon, children }: { n: number; icon: "share" | "plus" | "check"; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink">
        {n}
      </span>
      <span className="flex-1">{children}</span>
      <span className="h-5 w-5 flex-none text-muted">
        <Icon name={icon} />
      </span>
    </li>
  );
}
