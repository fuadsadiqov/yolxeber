"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERRORS: Record<string, string> = {
  invalid_credentials: "İstifadəçi adı və ya parol yanlışdır",
  too_many_attempts: "Çox sayda uğursuz cəhd. 10 dəqiqə sonra yenidən yoxlayın",
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: f.get("username"), password: f.get("password") }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const { error: code } = await res.json().catch(() => ({ error: "" }));
      setError(ERRORS[code] ?? "Xəta baş verdi, yenidən cəhd edin");
    } catch {
      setError("İnternet bağlantısını yoxlayın");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "h-14 w-full rounded-2xl border-[1.5px] border-line-strong bg-surface px-4 text-base text-ink outline-none focus:border-primary";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center">
            <span className="h-5 w-5 rotate-45 rounded-[3px] border-[3px] border-white bg-accent outline-2 outline-ink" />
          </span>
          <span className="text-[22px] font-bold tracking-tight">YolXəbər · Admin</span>
        </div>
        <label className="text-sm font-semibold text-muted" htmlFor="username">
          İstifadəçi adı
        </label>
        <input id="username" name="username" autoComplete="username" required className={input} />
        <label className="mt-1 text-sm font-semibold text-muted" htmlFor="password">
          Parol
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-soft-ink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-14 rounded-2xl bg-primary text-[17px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Yoxlanılır…" : "Daxil ol"}
        </button>
      </form>
    </main>
  );
}
