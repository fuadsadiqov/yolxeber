import type { Metadata } from "next";
import Link from "next/link";
import { adminCounts, adminReports, blockedDevices, requireAdmin } from "@/lib/admin";
import { LogoutButton } from "./LogoutButton";
import { AdminReportRow, UnblockButton } from "./AdminActions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "hidden", label: "Gizlədilənlər" },
  { key: "flagged", label: "Şikayət olunanlar" },
  { key: "recent", label: "Son bildirişlər" },
  { key: "blocked", label: "Bloklanmış cihazlar" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin();
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "hidden";
  const counts = await adminCounts();
  const badge: Partial<Record<Tab, number>> = { hidden: counts.hidden, flagged: counts.flagged, blocked: counts.blocked };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin panel</h1>
          <p className="text-sm text-muted">Şikayət həddini keçən bildirişlər avtomatik gizlədilir və burada görünür.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <Link href="/" className="font-semibold text-primary-ink">
            Sayta keç
          </Link>
          <span>{admin}</span>
          <LogoutButton />
        </div>
      </header>

      <nav className="no-scrollbar mt-5 flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1" aria-label="Bölmələr">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex h-10 flex-none items-center gap-2 rounded-[0.5625rem] px-3.5 text-sm whitespace-nowrap ${
              tab === t.key ? "bg-surface font-bold shadow-[0_1px_3px_rgba(22,33,28,.12)]" : "font-semibold text-muted"
            }`}
          >
            {t.label}
            {!!badge[t.key] && (
              <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white">{badge[t.key]}</span>
            )}
          </Link>
        ))}
      </nav>

      <section className="mt-4 flex flex-col gap-3">{tab === "blocked" ? <Blocked /> : <Reports tab={tab} />}</section>
    </main>
  );
}

async function Reports({ tab }: { tab: "hidden" | "flagged" | "recent" }) {
  const rows = await adminReports(tab);
  if (!rows.length) return <p className="rounded-2xl bg-surface p-6 text-center text-muted">Burada hələ heç nə yoxdur.</p>;
  return rows.map((r) => <AdminReportRow key={r.id} r={r} />);
}

async function Blocked() {
  const rows = await blockedDevices();
  if (!rows.length) return <p className="rounded-2xl bg-surface p-6 text-center text-muted">Bloklanmış cihaz yoxdur.</p>;
  return rows.map((d) => (
    <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm">{d.id}</div>
        <div className="text-[0.8125rem] text-muted">
          {d.blocked_at.toLocaleString("az-AZ")} · {d.reports} bildiriş{d.block_reason ? ` · ${d.block_reason}` : ""}
        </div>
      </div>
      <UnblockButton deviceId={d.id} />
    </div>
  ));
}
