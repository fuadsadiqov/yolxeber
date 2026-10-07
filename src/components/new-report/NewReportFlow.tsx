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

/** Redaktə rejimi üçün ilkin dəyərlər (müəllifin öz bildirişi) */
export type EditInitial = {
  id: string;
  category: CategoryKey;
  note: string;
  place: PickedPlace;
  media: DraftMedia[];
};

/** Multipart yükləmə — fetch yükləmə proqresini göstərə bilmədiyi üçün XHR */
function upload(method: "POST" | "PATCH", url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<{ id: string; votesReset?: boolean }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
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

/** Bildiriş əlavə etmə (və edit verilərsə — müəllifin redaktəsi) — eyni 3 addımlı forma */
export function NewReportFlow({ edit }: { edit?: EditInitial } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [media, setMedia] = useState<DraftMedia[]>(edit?.media ?? []);
  const [place, setPlace] = useState<PickedPlace | null>(edit?.place ?? null);
  const [category, setCategory] = useState<CategoryKey | null>(edit?.category ?? null);
  const [note, setNote] = useState(edit?.note ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [created, setCreated] = useState<{ id: string; title: string; address: string | null; category: CategoryKey } | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // Səhifədən çıxanda önizləmə URL-lərini azad edirik
  useEffect(() => () => mediaRef.current.forEach((m) => m.blob && URL.revokeObjectURL(m.url)), []);

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
    // Əl ilə yazılmış ünvan; yazılmayıbsa server koordinatdan özü təyin edir
    if (place.addressEdited && place.address?.trim()) form.set("address", place.address.trim());
    for (const m of media) {
      if (m.existingId) form.append("keep", m.existingId);
      else if (m.blob) form.append("media", m.blob, m.fileName);
    }
    setProgress(0);
    try {
      if (edit) {
        const r = await upload("PATCH", `/api/reports/${edit.id}`, form, setProgress);
        toast(r.votesReset ? "Dəyişikliklər saxlanıldı. Əsaslı dəyişiklik olduğu üçün təsdiqlər sıfırlandı." : "Dəyişikliklər saxlanıldı", {
          icon: "check",
        });
        router.replace(`/bildiris/${edit.id}`);
        router.refresh();
        return;
      }
      const { id } = await upload("POST", "/api/reports", form, setProgress);
      setCreated({ id, title: reportTitle(note, category), address: place.address?.trim() || null, category });
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
    <main className="relative mx-auto min-h-dvh max-w-[30rem] bg-bg pb-32">
      <WizardHeader
        title={edit ? "Bildirişi düzəlt" : "Yeni bildiriş"}
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
              `${edit ? "Saxlanılır" : "Göndərilir"}… ${Math.round(progress * 100)}%`
            ) : (
              <>
                <span className="h-5 w-5">
                  <Icon name={edit ? "check" : "send"} />
                </span>
                {edit ? "Yadda saxla" : "Paylaş"}
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
      className="mx-auto flex min-h-dvh max-w-[30rem] flex-col bg-surface"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(env(safe-area-inset-bottom) + 2.125rem)" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
        <div className="mb-6 flex h-[6.5rem] w-[6.5rem] items-center justify-center rounded-full bg-success-soft">
          <div className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-[#15803D] p-4 text-white">
            <Icon name="check" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="mb-2.5 text-[1.625rem] font-bold">Bildiriş paylaşıldı</h1>
        <p className="mb-6 text-base leading-normal text-pretty text-muted">
          Təşəkkürlər! Yaxınlıqdakı sürücülər dəyişikliyi xəritədə görəcək.
        </p>
        <div className="flex w-full items-center gap-3 rounded-2xl bg-bg p-3 text-left">
          <CategoryIcon category={created.category} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.9375rem] font-semibold">{created.title}</div>
            <div className="truncate text-[0.8125rem] text-muted">
              {[created.address ?? CATEGORIES[created.category].name, "indicə"].join(" · ")}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4">
        <Link href={`/bildiris/${created.id}`} replace className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[1.0625rem] font-bold text-white">
          Bildirişə bax
        </Link>
        <Link href="/" replace className="flex h-14 items-center justify-center rounded-2xl border-[0.0938rem] border-line-strong text-base font-semibold">
          Xəritəyə qayıt
        </Link>
      </div>
    </main>
  );
}
