"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

// design/TabBar.dc.html: Xəritə · (qaldırılmış sarı) Bildir · Lent
function Tab({ href, label, icon, active }: { href: string; label: string; icon: IconName; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-[0.1875rem] ${
        active ? "text-[var(--on-tab-active)]" : "text-muted"
      }`}
    >
      <span
        className={`flex h-[1.875rem] w-14 items-center justify-center rounded-[0.9375rem] ${active ? "bg-[var(--tab-pill)]" : ""}`}
      >
        <span className="h-[1.375rem] w-[1.375rem]">
          <Icon name={icon} />
        </span>
      </span>
      <span className={`text-[0.6875rem] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
    </Link>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="fixed inset-x-0 bottom-0 z-[1000] flex items-start border-t border-line bg-surface px-6 pt-1.5 md:hidden"
      style={{ height: "calc(5.25rem + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Tab href="/" label="Xəritə" icon="map" active={path === "/"} />
      {/* Mərkəzi "Bildir" — böyük, yumru, tab bar-dan yuxarı qalxmış əsas əməliyyat düyməsi */}
      <Link href="/bildir" className="-mt-8 flex flex-1 flex-col items-center gap-1" aria-label="Bildiriş əlavə et">
        <span
          className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-accent text-accent-ink transition-transform active:scale-95"
          style={{ boxShadow: "0 0 0 0.3125rem var(--surface), 0 0.5rem 1.25rem rgba(245,184,0,.5)" }}
        >
          <span className="h-8 w-8">
            <Icon name="plus" />
          </span>
        </span>
        <span className="text-[0.6875rem] font-bold text-muted">Bildir</span>
      </Link>
      <Tab href="/lent" label="Lent" icon="feed" active={path.startsWith("/lent")} />
    </nav>
  );
}
