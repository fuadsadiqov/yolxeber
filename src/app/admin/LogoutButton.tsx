"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
      }}
      className="h-10 rounded-xl border-[0.0938rem] border-line-strong px-3 font-semibold text-ink"
    >
      Çıxış
    </button>
  );
}
