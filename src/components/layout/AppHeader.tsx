"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "./theme";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center ${lg ? "h-10 w-10" : "h-[1.875rem] w-[1.875rem]"}`}>
        <span
          className={`rotate-45 bg-accent outline-ink ${lg ? "h-7 w-7 rounded border-4 outline-[0.1875rem]" : "h-5 w-5 rounded-[0.1875rem] border-[0.1875rem] outline-2"} border-white outline`}
        />
      </span>
      <span className={`font-bold tracking-tight ${lg ? "text-[2.5rem]" : "text-[1.3125rem]"}`}>YolXəbər</span>
    </span>
  );
}

const NAV = [
  { href: "/", label: "Xəritə" },
  { href: "/lent", label: "Lent" },
  { href: "/xeberdarliqlar", label: "Xəbərdarlıqlar" },
];

/** Masaüstü başlıq (dizayn 11): loqo · naviqasiya · tema · "Bildir". Mobil ekranda gizlidir. */
export function AppHeader() {
  const path = usePathname();
  return (
    <header className="hidden h-[4.25rem] flex-none items-center gap-6 border-b border-line bg-surface px-6 md:flex">
      <Link href="/" className="w-[24.5rem]" aria-label="YolXəbər — ana səhifə">
        <Logo />
      </Link>
      <div className="flex-1" />
      <nav className="flex gap-1 text-[0.9375rem] font-semibold">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`flex h-11 items-center rounded-xl px-3.5 ${on ? "bg-primary-soft text-primary-ink" : "text-muted hover:text-ink"}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      <ThemeToggle className="shadow-none" />
      <Link
        href="/bildir"
        className="flex h-[2.875rem] items-center gap-1.5 rounded-full bg-accent pl-3.5 pr-5 text-[0.9375rem] font-bold text-accent-ink"
      >
        <span className="h-5 w-5">
          <Icon name="plus" />
        </span>
        Bildir
      </Link>
    </header>
  );
}

/** Mobil ekranın yuxarı sağ küncü: xəbərdarlıqlar + tema */
export function TopActions({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`flex gap-2 ${className}`} style={style}>
      <Link
        href="/xeberdarliqlar"
        aria-label="Xəbərdarlıqlar"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-float dark:border dark:border-line"
      >
        <span className="h-5 w-5">
          <Icon name="bell" />
        </span>
      </Link>
      <ThemeToggle />
    </div>
  );
}
