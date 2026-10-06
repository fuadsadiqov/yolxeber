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
      <h2 id="cat-label" className="mb-3.5 text-[22px] font-bold">
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
              className={`relative flex h-[58px] items-center gap-2.5 rounded-[14px] border-2 px-2.5 text-left ${
                sel ? "border-primary bg-primary-soft" : "border-line bg-surface"
              }`}
            >
              <CategoryIcon category={c.key} size={34} icon={18} radius={10} />
              <span className="text-sm leading-tight font-semibold text-ink">{c.name}</span>
              {sel && (
                <span className="absolute -right-[7px] -top-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-bg bg-primary p-[3px] text-white">
                  <Icon name="check" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-2 mt-[18px] flex items-baseline justify-between">
        <label htmlFor="note" className="text-[15px] font-bold">
          Qısa qeyd
        </label>
        <span className="text-[13px] text-muted">istəyə bağlı</span>
      </div>
      <div className="relative">
        <textarea
          id="note"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Məs.: Gənclik istiqamətində, işıqforun üstündə yeni kamera. Limit 60 km/saat."
          rows={4}
          className="block h-[118px] w-full resize-none rounded-2xl border-2 border-line bg-surface px-3.5 pb-7 pt-3 text-[15px] leading-[1.45] text-ink outline-none placeholder:text-subtle focus:border-primary"
        />
        <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs font-semibold text-muted" aria-live="polite">
          {note.length} / {NOTE_MAX}
        </span>
      </div>
      <p className="mt-2 text-xs text-subtle">Qeydin ilk cümləsi bildirişin başlığı kimi göstərilir.</p>
    </div>
  );
}
