"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type ThemePref = "system" | "light" | "dark";
const KEY = "yx-theme";

/**
 * <head>-də render olunmazdan əvvəl işləyir ki, tünd temada "ağ yanıb-sönmə" olmasın.
 * Seçim localStorage-da saxlanır; "system" olduqda prefers-color-scheme izlənilir.
 */
const script = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var d=p==='dark'||(p==='system'&&m.matches);document.documentElement.dataset.theme=d?'dark':'light';}a();m.addEventListener('change',function(){p=localStorage.getItem('${KEY}')||'system';a();});}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setPref(readPref());
    const sync = () => setIsDark(document.documentElement.dataset.theme === "dark");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const set = (p: ThemePref) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {}
    setPref(p);
    apply(p);
  };

  return { pref, isDark, set };
}

/** Bir toxunuşla açıq ↔ tünd keçid. Sistem ayarına qayıtmaq üçün uzun basmaq. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { isDark, set } = useTheme();
  return (
    <button
      type="button"
      onClick={() => set(isDark ? "light" : "dark")}
      onContextMenu={(e) => {
        e.preventDefault();
        set("system");
      }}
      aria-label={isDark ? "Açıq temaya keç" : "Tünd temaya keç"}
      title={isDark ? "Açıq tema" : "Tünd tema"}
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-float dark:border dark:border-line ${className}`}
    >
      <span className="h-5 w-5">
        <Icon name={isDark ? "sun" : "moon"} />
      </span>
    </button>
  );
}
