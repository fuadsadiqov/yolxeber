"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Chromium-un quraşdırma hadisəsi (standart tiplərdə yoxdur) */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallCtx = {
  /** Android/masaüstü Chromium: sistem quraşdırma pəncərəsini açmaq mümkündür */
  canPrompt: boolean;
  /** iPhone/iPad: API yoxdur — "Paylaş → Ana ekrana əlavə et" təlimatı göstərilir */
  isIos: boolean;
  /** Tətbiq artıq ana ekrandan açılıb (quraşdırılıb) */
  installed: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

const Ctx = createContext<InstallCtx | null>(null);

// Hadisə səhifə yüklənən kimi gələ bilər — React komponentləri mount olmamışdan əvvəl tuturuq.
let early: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // brauzerin öz mini-bannerini göstərmə, düyməmizlə açacağıq
    early = e as BeforeInstallPromptEvent;
  });
}

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    if (early) setDeferred(early);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      early = null;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const e = deferred ?? early;
    if (!e) return "unavailable" as const;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // Hadisə yalnız bir dəfə istifadə oluna bilər
    setDeferred(null);
    early = null;
    if (outcome === "accepted") setInstalled(true);
    return outcome;
  }, [deferred]);

  const value = useMemo(
    () => ({ canPrompt: !!deferred && !installed, isIos: isIos && !installed, installed, promptInstall }),
    [deferred, installed, isIos, promptInstall],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInstall() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInstall InstallProvider daxilində istifadə olunmalıdır");
  return v;
}
