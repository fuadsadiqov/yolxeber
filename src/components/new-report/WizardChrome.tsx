import { Icon, type IconName } from "@/components/ui/Icon";

const STEPS = ["Media", "Yer", "Təfsilat"];

/** Addım başlığı — dizayn 03–05: sol düymə, "Yeni bildiriş", "1/3", proqres zolaqları */
export function WizardHeader({
  title = "Yeni bildiriş",
  step,
  leftIcon,
  onLeft,
  leftLabel,
}: {
  title?: string;
  step: 1 | 2 | 3;
  leftIcon: IconName;
  onLeft: () => void;
  leftLabel: string;
}) {
  return (
    <div className="px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 items-center justify-between">
        <button type="button" onClick={onLeft} aria-label={leftLabel} className="-ml-3 flex h-12 w-12 items-center justify-center text-ink">
          <span className="h-6 w-6">
            <Icon name={leftIcon} />
          </span>
        </button>
        <h1 className="text-[1.0625rem] font-bold">{title}</h1>
        <div className="w-12 text-right text-[0.9375rem] font-semibold text-primary-ink" aria-label={`Addım ${step}, cəmi 3`}>
          {step}/3
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 rounded-sm ${i < step ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs font-semibold text-subtle" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={i < step ? "text-primary-ink" : ""}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ekranın altında sabit əməliyyat paneli */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[800] border-t border-line bg-surface px-4 pt-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
    >
      <div className="mx-auto flex max-w-[30rem] gap-2.5">{children}</div>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[1.0625rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 items-center justify-center rounded-2xl border-[0.0938rem] border-line-strong text-base font-semibold text-ink ${className}`}
    >
      {children}
    </button>
  );
}
