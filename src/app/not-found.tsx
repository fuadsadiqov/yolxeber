import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <span className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary-soft p-[1.1875rem] text-primary-ink">
        <Icon name="pin" />
      </span>
      <h1 className="mb-2 text-[1.3125rem] font-bold">Səhifə tapılmadı</h1>
      <p className="mb-6 text-[0.9375rem] text-pretty text-muted">Bildiriş silinmiş, gizlədilmiş və ya link səhv ola bilər.</p>
      <Link href="/" className="flex h-14 items-center rounded-2xl bg-primary px-7 text-base font-bold text-white">
        Xəritəyə qayıt
      </Link>
    </main>
  );
}
