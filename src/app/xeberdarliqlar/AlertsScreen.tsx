"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapHandle } from "@/components/map/MapCanvas";
import { CategoryIcon } from "@/components/report/bits";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/client/api";
import { BAKU, useGeo } from "@/lib/client/geo";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/client/push";
import { CATEGORIES, CATEGORY_KEYS, CATEGORY_LIST, type CategoryKey } from "@/lib/categories";
import { formatDistance } from "@/lib/format";
import type { AlertZone } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

const RADII = [500, 1000, 2000, 3000, 5000, 10000, 20000];
// Dizayndakı ilkin seçim: parklanma və "digər" söndürülüb
const DEFAULT_CATS = CATEGORY_KEYS.filter((k) => k !== "park" && k !== "diger");

type Draft = Omit<AlertZone, "id"> & { id?: string };

export function AlertsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [zones, setZones] = useState<AlertZone[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    api<{ items: AlertZone[] }>("/api/alerts")
      .then((r) => setZones(r.items))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    reload();
    pushState().then(setPush);
  }, [reload]);

  async function turnOnPush() {
    try {
      setPush(await enablePush());
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Bildirişləri aktiv etmək alınmadı. Səhifəni yeniləyib yenidən cəhd edin.");
    }
  }

  async function toggleZone(z: AlertZone, enabled: boolean) {
    setZones((list) => list?.map((x) => (x.id === z.id ? { ...x, enabled } : x)) ?? null);
    try {
      await api(`/api/alerts/${z.id}`, { method: "PUT", json: { ...z, enabled } });
    } catch {
      toast("Yadda saxlanmadı");
      reload();
    }
  }

  async function remove(z: AlertZone) {
    setZones((list) => list?.filter((x) => x.id !== z.id) ?? null);
    try {
      await api(`/api/alerts/${z.id}`, { method: "DELETE" });
      toast("Ərazi silindi");
    } catch {
      reload();
    }
  }

  if (editing)
    return (
      <ZoneEditor
        draft={editing}
        onCancel={() => setEditing(null)}
        onSaved={(z) => {
          setZones((list) => {
            const l = list ?? [];
            return l.some((x) => x.id === z.id) ? l.map((x) => (x.id === z.id ? z : x)) : [...l, z];
          });
          setEditing(null);
          pushState().then(setPush);
        }}
      />
    );

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex h-14 items-center gap-1 md:mt-4">
        <button
          type="button"
          onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          aria-label="Geri"
          className="-ml-3 flex h-12 w-12 items-center justify-center md:hidden"
        >
          <span className="h-6 w-6">
            <Icon name="chevL" />
          </span>
        </button>
        <h1 className="text-[1.5rem] font-bold md:text-[1.75rem]">Xəbərdarlıqlar</h1>
      </header>
      <p className="mb-4 text-[0.9375rem] leading-normal text-muted">
        Xəritədə ərazi seçin — orada yeni bildiriş paylaşılanda telefonunuza bildiriş gələcək.
      </p>

      <PushCard state={push} onEnable={turnOnPush} onDisable={async () => (await disablePush(), setPush("off"))} />

      <div className="mt-5 flex flex-col gap-2.5">
        {zones === null && !failed && [1, 2].map((i) => <div key={i} className="h-[6.5rem] rounded-[1.125rem] bg-surface" />)}
        {failed && (
          <button type="button" onClick={reload} className="h-12 font-semibold text-primary-ink">
            Yükləmək alınmadı — yenidən cəhd et
          </button>
        )}
        {zones?.length === 0 && (
          <div className="flex flex-col items-center rounded-[1.125rem] bg-surface px-6 py-8 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft p-3.5 text-primary-ink">
              <Icon name="bell" />
            </span>
            <div className="mb-1 text-[1.0625rem] font-bold">Hələ ərazi əlavə etməmisiniz</div>
            <p className="text-sm text-muted">Məsələn, ev və iş yolunuzu əlavə edin.</p>
          </div>
        )}
        {zones?.map((z) => (
          <article key={z.id} className="rounded-[1.125rem] bg-surface p-4">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => setEditing(z)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[1.0625rem] font-bold">{z.name}</div>
                <div className="text-[0.8125rem] text-muted">{formatDistance(z.radiusM)} radius · {z.categories.length} kateqoriya</div>
              </button>
              <Switch checked={z.enabled} onChange={(v) => toggleZone(z, v)} label={`${z.name} — aktiv`} />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {z.categories.map((c) => (
                <CategoryIcon key={c} category={c} size={26} icon={14} radius={8} />
              ))}
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => setEditing(z)} className="h-10 rounded-xl px-3 text-sm font-semibold text-primary-ink">
                  Dəyiş
                </button>
                <button type="button" onClick={() => remove(z)} aria-label={`${z.name} — sil`} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted">
                  <span className="h-5 w-5">
                    <Icon name="trash" />
                  </span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {zones && (
        <button
          type="button"
          onClick={() => setEditing({ name: zones.length === 0 ? "Ev" : `Ərazi ${zones.length + 1}`, lat: BAKU.lat, lng: BAKU.lng, radiusM: 2000, categories: DEFAULT_CATS, enabled: true })}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[1.0625rem] font-bold text-white"
        >
          <span className="h-[1.375rem] w-[1.375rem]">
            <Icon name="plus" />
          </span>
          Yeni ərazi əlavə et
        </button>
      )}
    </main>
  );
}

function PushCard({ state, onEnable, onDisable }: { state: PushState | null; onEnable: () => void; onDisable: () => void }) {
  if (!state) return <div className="h-[4.75rem] rounded-[1.125rem] bg-surface" />;
  const box = "flex items-center gap-3 rounded-[1.125rem] px-4 py-3.5";
  if (state === "on")
    return (
      <div className={`${box} bg-success-soft text-success`}>
        <span className="h-6 w-6 flex-none">
          <Icon name="bell" />
        </span>
        <span className="flex-1 text-[0.9375rem] font-semibold">Bildirişlər bu cihazda aktivdir</span>
        <button type="button" onClick={onDisable} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">
          Söndür
        </button>
      </div>
    );
  if (state === "off")
    return (
      <div className={`${box} bg-accent-badge-bg text-accent-badge-fg`}>
        <span className="h-6 w-6 flex-none">
          <Icon name="bell" />
        </span>
        <span className="flex-1 text-[0.9375rem] font-semibold">Bildirişlər söndürülüb</span>
        <button type="button" onClick={onEnable} className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-ink">
          Aktiv et
        </button>
      </div>
    );
  const text =
    state === "denied"
      ? "Bildirişlər brauzer ayarlarında bloklanıb. Sayt ayarlarından icazə verin."
      : state === "ios-install"
        ? "iPhone-da bildiriş almaq üçün: Paylaş → “Ana ekrana əlavə et”, sonra tətbiqi ana ekrandan açın."
        : "Bu brauzer push bildirişlərini dəstəkləmir.";
  return (
    <div className={`${box} bg-line-soft text-muted`}>
      <span className="h-6 w-6 flex-none">
        <Icon name="bell" />
      </span>
      <span className="text-sm leading-snug">{text}</span>
    </div>
  );
}

function ZoneEditor({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: (z: AlertZone) => void }) {
  const { position, locate } = useGeo();
  const toast = useToast();
  const mapRef = useRef<MapHandle>(null);
  const [d, setD] = useState<Draft>(() => (draft.id || !position ? draft : { ...draft, lat: position.lat, lng: position.lng }));
  const [initial] = useState(() => ({ lat: d.lat, lng: d.lng }));
  const [saving, setSaving] = useState(false);
  const radiusIdx = Math.max(0, RADII.findIndex((r) => r >= d.radiusM));

  const toggleCat = (k: CategoryKey, on: boolean) =>
    setD((x) => ({ ...x, categories: on ? CATEGORY_KEYS.filter((c) => c === k || x.categories.includes(c)) : x.categories.filter((c) => c !== k) }));

  async function save() {
    const center = mapRef.current?.getCenter() ?? d;
    const body = { name: d.name.trim() || "Ərazi", lat: center.lat, lng: center.lng, radiusM: d.radiusM, categories: d.categories, enabled: d.enabled };
    setSaving(true);
    try {
      const z = d.id
        ? await api<AlertZone>(`/api/alerts/${d.id}`, { method: "PUT", json: body })
        : await api<AlertZone>("/api/alerts", { method: "POST", json: body });
      // İlk ərazidən sonra push icazəsi istəyirik — kontekst aydın olanda istifadəçi daha çox razılaşır
      const st = await pushState();
      if (st === "off") await enablePush().catch(() => toast("Bildiriş icazəsi alınmadı"));
      onSaved(z);
      toast("Ərazi yadda saxlanıldı", { icon: "check" });
    } catch (e) {
      toast(e instanceof ApiError ? (e.code === "too_many_zones" ? "Ən çox 10 ərazi əlavə etmək olar." : e.message) : "Xəta baş verdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex h-14 items-center justify-between px-4">
        <button type="button" onClick={onCancel} aria-label="Ləğv et" className="-ml-3 flex h-12 w-12 items-center justify-center">
          <span className="h-6 w-6">
            <Icon name="x" />
          </span>
        </button>
        <h1 className="text-[1.0625rem] font-bold">{d.id ? "Ərazini dəyiş" : "Yeni ərazi"}</h1>
        <span className="w-12" />
      </header>

      <div className="relative h-[42dvh] min-h-[16.25rem] overflow-hidden">
        <MapCanvas ref={mapRef} center={initial} zoom={d.radiusM > 5000 ? 11 : 13} centerCircleM={d.radiusM} me={position} />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[600] -ml-2 -mt-2 h-4 w-4 rounded-full border-[0.1875rem] border-white bg-primary shadow" />
        <div className="pointer-events-none absolute left-1/2 top-3 z-[600] flex h-9 -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-[#16211C] px-3.5 text-[0.8125rem] font-semibold text-white">
          Mərkəzi seçmək üçün xəritəni sürüşdürün
        </div>
        <button
          type="button"
          onClick={async () => {
            const f = await locate();
            if (f) mapRef.current?.flyTo(f, 13);
          }}
          aria-label="Mənim yerim"
          className="absolute bottom-3 right-3 z-[600] flex h-12 w-12 items-center justify-center rounded-[0.875rem] bg-surface p-3 text-primary-ink shadow-float"
        >
          <Icon name="locate" />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-32 pt-5">
        <label className="flex flex-col gap-2">
          <span className="text-[0.9375rem] font-bold">Ad</span>
          <input
            value={d.name}
            maxLength={60}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            className="h-14 rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-primary"
          />
        </label>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="radius" className="text-[0.9375rem] font-bold">
              Radius
            </label>
            <span className="text-[0.9375rem] font-bold text-primary-ink">{formatDistance(d.radiusM)}</span>
          </div>
          <input
            id="radius"
            type="range"
            min={0}
            max={RADII.length - 1}
            step={1}
            value={radiusIdx}
            onChange={(e) => setD({ ...d, radiusM: RADII[Number(e.target.value)] })}
            className="w-full accent-[#00A86B]"
            aria-valuetext={formatDistance(d.radiusM)}
          />
          <div className="mt-1 flex justify-between text-xs text-subtle">
            <span>500 m</span>
            <span>20 km</span>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[0.9375rem] font-bold">Kateqoriyalar</div>
          <div className="overflow-hidden rounded-[1.125rem] bg-surface">
            {CATEGORY_LIST.map((c, i) => (
              <div key={c.key} className={`flex min-h-[3.75rem] items-center gap-3 px-3.5 ${i ? "border-t border-line-soft" : ""}`}>
                <CategoryIcon category={c.key} size={34} icon={18} radius={10} />
                <span className="flex-1 text-[0.9375rem] font-semibold">{c.name}</span>
                <Switch checked={d.categories.includes(c.key)} onChange={(v) => toggleCat(c.key, v)} label={CATEGORIES[c.key].name} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-[800] border-t border-line bg-surface px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <button
          type="button"
          onClick={save}
          disabled={saving || d.categories.length === 0}
          className="mx-auto flex h-14 w-full max-w-2xl items-center justify-center gap-2 rounded-2xl bg-primary text-[1.0625rem] font-bold text-white disabled:opacity-50"
        >
          {saving ? "Yadda saxlanılır…" : d.categories.length === 0 ? "Ən azı bir kateqoriya seçin" : "Yadda saxla"}
        </button>
      </div>
    </main>
  );
}
