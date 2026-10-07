"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type ToastOpts = { icon?: IconName; action?: { label: string; onClick: () => void }; duration?: number };
type Toast = ToastOpts & { id: number; text: string };

const Ctx = createContext<(text: string, opts?: ToastOpts) => void>(() => {});

/** Dizayndakı tünd "snackbar" (məs. "Yer məlumatına icazə verilməyib · İcazə ver") */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string, opts: ToastOpts = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, ...opts });
    timer.current = setTimeout(() => setToast(null), opts.duration ?? (opts.action ? 7000 : 3500));
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 z-[2000] flex justify-center md:bottom-6"
        style={{ bottom: "calc(6.25rem + env(safe-area-inset-bottom))" }}
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-toast py-2.5 pl-4 pr-2 text-white shadow-[0_10px_24px_rgba(22,33,28,.3)]"
          >
            {toast.icon && (
              <span className="h-5 w-5 flex-none text-accent">
                <Icon name={toast.icon} />
              </span>
            )}
            <span className="min-h-[1.5rem] flex-1 py-1 text-sm leading-snug">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
                className="h-11 flex-none rounded-xl px-3.5 text-sm font-bold text-accent"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
