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
      className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px] ${
        active ? "text-[var(--on-tab-active)]" : "text-muted"
      }`}
    >
      <span
        className={`flex h-[30px] w-14 items-center justify-center rounded-[15px] ${active ? "bg-[var(--tab-pill)]" : ""}`}
      >
        <span className="h-[22px] w-[22px]">
          <Icon name={icon} />
        </span>
      </span>
      <span className={`text-[11px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
    </Link>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="fixed inset-x-0 bottom-0 z-[1000] flex items-start border-t border-line bg-surface px-6 pt-1.5 md:hidden"
      style={{ height: "calc(84px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Tab href="/" label="Xəritə" icon="map" active={path === "/"} />
      <Link href="/bildir" className="-mt-5 flex flex-1 flex-col items-center gap-[3px]" aria-label="Bildiriş əlavə et">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent text-accent-ink"
          style={{ boxShadow: "0 0 0 4px var(--surface), 0 8px 18px rgba(245,184,0,.45)" }}
        >
          <span className="h-7 w-7">
            <Icon name="plus" />
          </span>
        </span>
        <span className="text-[11px] font-bold text-muted">Bildir</span>
      </Link>
      <Tab href="/lent" label="Lent" icon="feed" active={path.startsWith("/lent")} />
    </nav>
  );
}
