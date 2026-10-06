"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { CategoryIcon } from "@/components/report/bits";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { API_ERRORS } from "@/lib/types";
import { reportTitle } from "@/lib/format";
import type { DraftMedia } from "@/lib/client/media";
import { StepMedia } from "./StepMedia";
import { StepLocation, type PickedPlace } from "./StepLocation";
import { StepDetails } from "./StepDetails";
import { BottomBar, PrimaryButton, SecondaryButton, WizardHeader } from "./WizardChrome";

type Step = 1 | 2 | 3 | "done";

/** Multipart yükləmə — fetch yükləmə proqresini göstərə bilmədiyi üçün XHR */
function upload(form: FormData, onProgress: (p: number) => void) {
  return new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reports");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new Error(API_ERRORS[xhr.response?.error] ?? "Göndərmək alınmadı. Yenidən cəhd edin."));
    };
    xhr.onerror = () => reject(new Error("İnternet bağlantısını yoxlayın."));
    xhr.send(form);
  });
}

export function NewReportFlow() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [created, setCreated] = useState<{ id: string; title: string; address: string | null; category: CategoryKey } | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // Səhifədən çıxanda önizləmə URL-lərini azad edirik
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  // Telefonun "geri" düyməsi addımlar arasında işləsin: irəli gedəndə history-yə yazı əlavə edirik,
  // geri (popstate) gələndə bir addım geri qayıdırıq.
  useEffect(() => {
    const onPop = () => setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goTo = (s: 2 | 3) => {
    history.pushState({ yxStep: s }, "");
    setStep(s);
  };

  async function submit() {
    if (!place || !category || !media.length) return;
    const form = new FormData();
    form.set("category", category);
    form.set("note", note.trim());
    form.set("lat", place.lat.toFixed(6));
    form.set("lng", place.lng.toFixed(6));
    for (const m of media) form.append("media", m.blob, m.fileName);
    setProgress(0);
    try {
      const { id } = await upload(form, setProgress);
      setCreated({ id, title: reportTitle(note, category), address: place.address, category });
      setStep("done");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  const close = () => (history.length > 1 ? router.back() : router.push("/"));

  if (step === "done" && created) return <Success created={created} />;

  return (
    <main className="relative mx-auto min-h-dvh max-w-[480px] bg-bg pb-32">
      <WizardHeader
        step={step as 1 | 2 | 3}
        leftIcon={step === 1 ? "x" : "chevL"}
        leftLabel={step === 1 ? "Bağla" : "Geri"}
        onLeft={() => (step === 1 ? close() : history.back())}
      />

      {step === 1 && <StepMedia media={media} setMedia={setMedia} />}
      {step === 2 && <StepLocation place={place} setPlace={setPlace} />}
      {step === 3 && <StepDetails category={category} setCategory={setCategory} note={note} setNote={setNote} />}

      <BottomBar>
        {step === 2 && (
          <SecondaryButton className="w-28" onClick={() => history.back()}>
            Geri
          </SecondaryButton>
        )}
        {step === 3 ? (
          <PrimaryButton disabled={!category || progress != null} onClick={submit}>
            {progress != null ? (
              `Göndərilir… ${Math.round(progress * 100)}%`
            ) : (
              <>
                <span className="h-5 w-5">
                  <Icon name="send" />
                </span>
                Paylaş
              </>
            )}
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={step === 1 ? media.length === 0 : !place} onClick={() => goTo(step === 1 ? 2 : 3)}>
            Növbəti
            <span className="h-5 w-5">
              <Icon name="chevR" />
            </span>
          </PrimaryButton>
        )}
      </BottomBar>
    </main>
  );
}

/** Uğur ekranı (dizayn 06) */
function Success({ created }: { created: { id: string; title: string; address: string | null; category: CategoryKey } }) {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-surface"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(env(safe-area-inset-bottom) + 34px)" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
        <div className="mb-6 flex h-[104px] w-[104px] items-center justify-center rounded-full bg-success-soft">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#15803D] p-4 text-white">
            <Icon name="check" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="mb-2.5 text-[26px] font-bold">Bildiriş paylaşıldı</h1>
        <p className="mb-6 text-base leading-normal text-pretty text-muted">
          Təşəkkürlər! Yaxınlıqdakı sürücülər dəyişikliyi xəritədə görəcək.
        </p>
        <div className="flex w-full items-center gap-3 rounded-2xl bg-bg p-3 text-left">
          <CategoryIcon category={created.category} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{created.title}</div>
            <div className="truncate text-[13px] text-muted">
              {[created.address ?? CATEGORIES[created.category].name, "indicə"].join(" · ")}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4">
        <Link href={`/bildiris/${created.id}`} replace className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-white">
          Bildirişə bax
        </Link>
        <Link href="/" replace className="flex h-14 items-center justify-center rounded-2xl border-[1.5px] border-line-strong text-base font-semibold">
          Xəritəyə qayıt
        </Link>
      </div>
    </main>
  );
}
