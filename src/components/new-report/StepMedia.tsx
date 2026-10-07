"use client";

import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatTime } from "@/lib/format";
import { MAX_FILES, MediaError, prepareMedia, type DraftMedia } from "@/lib/client/media";
import { STRIPES } from "@/components/report/bits";

type Props = {
  media: DraftMedia[];
  setMedia: (fn: (m: DraftMedia[]) => DraftMedia[]) => void;
};

/** Addım 1 (dizayn 03): kamera / video / qalereya, böyük önizləmə, miniatürlər */
export function StepMedia({ media, setMedia }: Props) {
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const photoIn = useRef<HTMLInputElement>(null);
  const videoIn = useRef<HTMLInputElement>(null);
  const galleryIn = useRef<HTMLInputElement>(null);
  const replaceIdx = useRef<number | null>(null);

  const current = media[Math.min(active, media.length - 1)];

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const replacing = replaceIdx.current;
    replaceIdx.current = null;
    const room = replacing != null ? 1 : MAX_FILES - media.length;
    if (room <= 0) {
      toast("Ən çox 4 fayl əlavə etmək olar.");
      return;
    }
    setBusy(true);
    const ready: DraftMedia[] = [];
    for (const f of files.slice(0, room)) {
      try {
        ready.push(await prepareMedia(f));
      } catch (e) {
        toast(e instanceof MediaError ? e.message : "Fayl əlavə olunmadı.");
      }
    }
    setBusy(false);
    if (files.length > room) toast("Ən çox 4 fayl əlavə etmək olar.");
    if (!ready.length) return;

    setMedia((prev) => {
      let next = prev;
      if (replacing != null && prev[replacing]) {
        URL.revokeObjectURL(prev[replacing].url);
        next = prev.map((m, i) => (i === replacing ? ready[0] : m));
      } else next = [...prev, ...ready];
      // Yalnız bir video icazəlidir
      const videos = next.filter((m) => m.kind === "video");
      if (videos.length > 1) {
        toast("Yalnız bir video əlavə etmək olar.");
        const drop = new Set(videos.slice(1).map((v) => v.id));
        next.filter((m) => drop.has(m.id)).forEach((m) => URL.revokeObjectURL(m.url));
        next = next.filter((m) => !drop.has(m.id));
      }
      return next;
    });
    setActive(replacing ?? media.length);
  }

  function remove(i: number) {
    setMedia((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
    setActive((a) => Math.max(0, a >= i ? a - 1 : a));
  }

  const pick = (input: React.RefObject<HTMLInputElement | null>, replace: number | null = null) => {
    replaceIdx.current = replace;
    input.current?.click();
  };

  return (
    <div className="px-4 pt-5">
      <h2 className="mb-1 text-[1.375rem] font-bold">Nə gördünüz?</h2>
      <p className="mb-4 text-[0.9375rem] text-muted">Nişan, kamera və ya xətt aydın görünsün.</p>

      <div className="relative h-[19.75rem] overflow-hidden rounded-[1.25rem]" style={{ background: STRIPES }}>
        {current ? (
          current.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt="Seçilmiş şəkil" className="h-full w-full object-cover" />
          ) : (
            <video src={current.url} className="h-full w-full bg-black object-contain" controls playsInline muted />
          )
        ) : (
          <button
            type="button"
            onClick={() => pick(photoIn)}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted"
          >
            <span className="h-10 w-10">
              <Icon name="camera" />
            </span>
            <span className="text-sm font-semibold">Şəkil və ya video əlavə edin</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-semibold text-white">
            Hazırlanır…
          </div>
        )}
        {current && (
          <>
            <button
              type="button"
              onClick={() => remove(media.indexOf(current))}
              aria-label="Sil"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(22,33,28,.72)] text-white"
            >
              <span className="h-5 w-5">
                <Icon name="trash" />
              </span>
            </button>
            <span className="absolute bottom-3 left-3 flex h-8 items-center gap-1.5 rounded-2xl bg-[rgba(22,33,28,.72)] px-3 text-[0.8125rem] font-semibold text-white">
              <span className="h-4 w-4">
                <Icon name={current.kind === "video" ? "video" : "camera"} />
              </span>
              {current.kind === "video"
                ? `Video · 0:${String(Math.round(current.durationS ?? 0)).padStart(2, "0")}`
                : `Foto · ${formatTime(current.capturedAt)}`}
            </span>
            <button
              type="button"
              onClick={() => pick(current.kind === "video" ? videoIn : photoIn, media.indexOf(current))}
              className="absolute bottom-3 right-3 flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-[#16211C]"
            >
              <span className="h-[1.125rem] w-[1.125rem]">
                <Icon name="refresh" />
              </span>
              Yenidən çək
            </button>
          </>
        )}
      </div>

      {media.length > 0 && (
        <div className="mt-2.5 flex gap-2" role="listbox" aria-label="Əlavə olunmuş fayllar">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={m === current}
              onClick={() => setActive(i)}
              className={`relative h-[3.75rem] w-[3.75rem] overflow-hidden rounded-xl border-2 ${m === current ? "border-primary" : "border-transparent"}`}
              style={{ background: STRIPES }}
            >
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-black/70 p-4 text-white">
                  <Icon name="video" />
                </span>
              )}
            </button>
          ))}
          {media.length < MAX_FILES && (
            <button
              type="button"
              onClick={() => pick(galleryIn)}
              aria-label="Daha çox əlavə et"
              className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-xl border-2 border-dashed border-line-strong text-muted"
            >
              <span className="h-[1.375rem] w-[1.375rem]">
                <Icon name="plus" />
              </span>
            </button>
          )}
        </div>
      )}

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <SourceButton icon="camera" label="Şəkil çək" onClick={() => pick(photoIn)} />
        <SourceButton icon="video" label="Video çək" onClick={() => pick(videoIn)} />
        <SourceButton icon="image" label="Qalereya" onClick={() => pick(galleryIn)} />
      </div>
      <p className="mt-3 text-center text-xs text-subtle">Video — maksimum 30 saniyə və 50 MB. Şəkillərdən yer və cihaz məlumatları silinir.</p>

      {/* capture="environment" — telefonda birbaşa arxa kamera açılır */}
      <input ref={photoIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
      <input ref={videoIn} type="file" accept="video/*" capture="environment" hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
      <input ref={galleryIn} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
    </div>
  );
}

function SourceButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface text-sm font-semibold text-primary-ink"
    >
      <span className="h-[1.625rem] w-[1.625rem]">
        <Icon name={icon} />
      </span>
      {label}
    </button>
  );
}
