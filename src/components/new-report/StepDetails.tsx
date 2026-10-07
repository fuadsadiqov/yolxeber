"use client";

import { Icon } from "@/components/ui/Icon";
import { CATEGORY_LIST, type CategoryKey } from "@/lib/categories";
import { CategoryIcon } from "@/components/report/bits";

export const NOTE_MAX = 280;

/** Addım 3 (dizayn 05): kateqoriya seçimi + 280 simvolluq qeyd */
export function StepDetails({
  category,
  setCategory,
  note,
  setNote,
}: {
  category: CategoryKey | null;
  setCategory: (c: CategoryKey) => void;
  note: string;
  setNote: (n: string) => void;
}) {
  return (
    <div className="px-4 pt-5">
      <h2 id="cat-label" className="mb-3.5 text-[1.375rem] font-bold">
        Nə dəyişib?
      </h2>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="cat-label">
        {CATEGORY_LIST.map((c) => {
          const sel = c.key === category;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => setCategory(c.key)}
              className={`relative flex h-[3.625rem] items-center gap-2.5 rounded-[0.875rem] border-2 px-2.5 text-left ${
                sel ? "border-primary bg-primary-soft" : "border-line bg-surface"
              }`}
            >
              <CategoryIcon category={c.key} size={34} icon={18} radius={10} />
              <span className="text-sm leading-tight font-semibold text-ink">{c.name}</span>
              {sel && (
                <span className="absolute -right-[0.4375rem] -top-[0.4375rem] flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full border-2 border-bg bg-primary p-[0.1875rem] text-white">
                  <Icon name="check" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-2 mt-[1.125rem] flex items-baseline justify-between">
        <label htmlFor="note" className="text-[0.9375rem] font-bold">
          Qısa qeyd
        </label>
        <span className="text-[0.8125rem] text-muted">istəyə bağlı</span>
      </div>
      <div className="relative">
        <textarea
          id="note"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Məs.: Gənclik istiqamətində, işıqforun üstündə yeni kamera. Limit 60 km/saat."
          rows={4}
          className="block h-[7.375rem] w-full resize-none rounded-2xl border-2 border-line bg-surface px-3.5 pb-7 pt-3 text-[0.9375rem] leading-[1.45] text-ink outline-none placeholder:text-subtle focus:border-primary"
        />
        <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs font-semibold text-muted" aria-live="polite">
          {note.length} / {NOTE_MAX}
        </span>
      </div>
      <p className="mt-2 text-xs text-subtle">Qeydin ilk cümləsi bildirişin başlığı kimi göstərilir.</p>
    </div>
  );
}
