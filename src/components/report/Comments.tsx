"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, qs } from "@/lib/client/api";
import { track } from "@/lib/client/analytics";
import { relativeTime } from "@/lib/format";
import type { CommentItem, CommentPage } from "@/lib/types";

const MAX = 500;
// Təxəllüsə görə sabit avatar rəngi
const AVATAR = ["#0E7C86", "#1D5BD8", "#9F1239", "#EA6A12", "#15803D", "#7C3AED", "#8A5F00"];
const avatarColor = (nick: string) => AVATAR[parseInt(nick, 16) % AVATAR.length] ?? AVATAR[0];

/** Bildiriş detalının ən aşağısında rəylər: yazma forması + siyahı (yeni → köhnə) */
export function Comments({ reportId }: { reportId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (more: string | null) => {
      try {
        const p = await api<CommentPage>(`/api/reports/${reportId}/comments?${qs({ cursor: more })}`);
        setItems((prev) => (more && prev ? [...prev, ...p.items.filter((x) => !prev.some((y) => y.id === x.id))] : p.items));
        setTotal(p.total);
        setCursor(p.nextCursor);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    [reportId],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const c = await api<CommentItem>(`/api/reports/${reportId}/comments`, { method: "POST", json: { body } });
      setItems((prev) => [c, ...(prev ?? [])]);
      setTotal((n) => n + 1);
      setText("");
      track("comment_posted");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Rəy göndərilmədi.");
    } finally {
      setSending(false);
    }
  }

  async function remove(c: CommentItem) {
    try {
      await api(`/api/comments/${c.id}`, { method: "DELETE" });
      setItems((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
      setTotal((n) => Math.max(0, n - 1));
      toast("Rəy silindi");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Silinmədi.");
    }
  }

  async function flag(c: CommentItem) {
    try {
      await api(`/api/comments/${c.id}/flag`, { method: "POST" });
      setItems((prev) => prev?.map((x) => (x.id === c.id ? { ...x, myFlagged: true } : x)) ?? null);
      toast("Şikayətiniz qəbul edildi", { icon: "check" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_flagged")
        setItems((prev) => prev?.map((x) => (x.id === c.id ? { ...x, myFlagged: true } : x)) ?? null);
      else toast(err instanceof ApiError ? err.message : "Göndərilmədi.");
    }
  }

  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-3">
      <h2 id="comments-title" className="text-[0.8125rem] font-semibold tracking-[.06em] text-muted">
        RƏYLƏR{total ? ` · ${total}` : ""}
      </h2>

      <form onSubmit={send} className="rounded-[1.125rem] bg-surface p-3">
        <label htmlFor="comment" className="sr-only">
          Rəyiniz
        </label>
        <textarea
          id="comment"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder="Fikrinizi bildirin: hələ də belədir? Nə dəyişib?"
          rows={3}
          className="block w-full resize-none rounded-xl border-2 border-line bg-bg px-3 py-2.5 text-[0.9375rem] leading-snug outline-none placeholder:text-subtle focus:border-primary"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-subtle">
            Anonim · {text.length} / {MAX}
          </span>
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <span className="h-4 w-4">
              <Icon name="send" />
            </span>
            {sending ? "Göndərilir…" : "Göndər"}
          </button>
        </div>
      </form>

      {items === null && !failed && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-[4.5rem] rounded-[1.125rem] bg-surface" />
          ))}
        </div>
      )}
      {failed && items === null && (
        <button type="button" onClick={() => load(null)} className="h-11 text-sm font-semibold text-primary-ink">
          Rəyləri yükləmək alınmadı — yenidən cəhd et
        </button>
      )}
      {items?.length === 0 && <p className="py-3 text-center text-sm text-muted">Hələ rəy yoxdur. İlk rəyi siz yazın.</p>}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id} className="rounded-[1.125rem] bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[0.6875rem] font-bold text-white"
                  style={{ background: avatarColor(c.nickname) }}
                  aria-hidden="true"
                >
                  {c.nickname.slice(0, 2)}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
                  <span className="text-sm font-semibold">Sürücü {c.nickname}</span>
                  {c.isAuthor && (
                    <span className="rounded-full bg-primary-soft px-1.5 py-px text-[0.6875rem] font-bold text-primary-ink">Müəllif</span>
                  )}
                  {c.isMine && <span className="rounded-full bg-line-soft px-1.5 py-px text-[0.6875rem] font-bold text-muted">Siz</span>}
                  <time suppressHydrationWarning dateTime={c.createdAt} className="text-xs text-muted">
                    · {relativeTime(c.createdAt)}
                  </time>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-[0.9375rem] leading-normal">{c.body}</p>
              <div className="mt-1.5 flex justify-end">
                {c.isMine ? (
                  <button type="button" onClick={() => remove(c)} className="h-8 rounded-lg px-2 text-xs font-semibold text-muted">
                    Sil
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => flag(c)}
                    disabled={c.myFlagged}
                    className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted disabled:opacity-60"
                  >
                    <span className="h-3.5 w-3.5">
                      <Icon name="flag" />
                    </span>
                    {c.myFlagged ? "Şikayət edildi" : "Şikayət et"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            await load(cursor);
            setLoadingMore(false);
          }}
          className="h-11 text-sm font-semibold text-primary-ink disabled:opacity-60"
        >
          {loadingMore ? "Yüklənir…" : "Daha çox rəy"}
        </button>
      )}
    </section>
  );
}
