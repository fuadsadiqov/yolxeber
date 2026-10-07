"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useInstall } from "@/lib/client/install";
import { IosInstallSteps } from "./InstallButton";

const KEY = "yx-install-snoozed-at";
/** İmtina etdikdən sonra pəncərə bu qədər müddət çıxmır */
const SNOOZE_MS = 3 * 24 * 3600_000;
/** İlk girişdə dərhal yox — istifadəçi səhifəni görsün deyə bir az sonra */
const DELAY_MS = 4000;
/** Bu səhifələrdə (forma doldurarkən, admin) pəncərə göstərilmir */
const SKIP = [/^\/admin/, /^\/bildir$/, /\/duzelt$/, /^\/offline/];

function snoozed() {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {}
}

/**
 * Ana ekrana əlavə etmə təklifi — ekranın ortasında modal.
 * Quraşdırılıbsa heç vaxt; imtina olunubsa 3 gün çıxmır.
 */
export function InstallPrompt() {
  const { canPrompt, isIos, installed, promptInstall } = useInstall();
  const path = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const shown = useRef(false);

  const available = (canPrompt || isIos) && !installed;
  const skip = SKIP.some((re) => re.test(path));

  useEffect(() => {
    if (!available || skip || shown.current || snoozed()) return;
    const t = setTimeout(() => {
      if (snoozed()) return;
      shown.current = true;
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [available, skip]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && later();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function later() {
    snooze();
    setOpen(false);
  }

  async function install() {
    const r = await promptInstall();
    setOpen(false);
    if (r === "accepted") toast("YolXəbər ana ekrana əlavə olunur", { icon: "check" });
    // Sistem pəncərəsində imtina — 3 gün sonra yenidən təklif edirik
    else snooze();
  }

  if (!open || !available) return null;

  return (
    <div className="fixed inset-0 z-[1700] flex items-center justify-center p-5" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={later} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="relative w-full max-w-[22rem] rounded-3xl bg-surface p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,.3)] dark:border dark:border-line"
      >
        <button
          type="button"
          onClick={later}
          aria-label="Bağla"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted"
        >
          <span className="h-5 w-5">
            <Icon name="x" />
          </span>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="mx-auto mb-4 h-[4.5rem] w-[4.5rem] rounded-[1.25rem] shadow-float" />
        <h2 id="install-title" className="mb-1.5 text-[1.25rem] font-bold">
          YolXəbər-i ana ekrana əlavə edin
        </h2>
        <p className="mb-5 text-[0.9375rem] leading-normal text-pretty text-muted">
          Tətbiq kimi bir toxunuşla açılır, tam ekran işləyir və yeni bildirişlər haqqında xəbərlər daha etibarlı gəlir.
        </p>

        {isIos ? (
          <>
            <IosInstallSteps />
            <button type="button" onClick={later} className="mt-4 h-12 w-full rounded-2xl bg-primary text-base font-bold text-white">
              Başa düşdüm
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={install}
              className="flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white"
            >
              <span className="h-5 w-5">
                <Icon name="download" />
              </span>
              Ana ekrana əlavə et
            </button>
            <button type="button" onClick={later} className="h-11 rounded-2xl text-[0.9375rem] font-semibold text-muted">
              Sonra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
