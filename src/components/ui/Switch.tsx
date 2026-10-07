"use client";

/** Dizayndakı toggle (alertCats): aktiv — yaşıl, passiv — boz */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-12 flex-none items-center rounded-full p-[0.1875rem] transition-colors ${
        checked ? "justify-end bg-primary" : "justify-start bg-line-strong"
      }`}
    >
      <span className="h-[1.375rem] w-[1.375rem] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" />
    </button>
  );
}
