"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Grade } from "ts-fsrs";
import { fromFsrsCard, previewIntervals, RATINGS, scheduler, toFsrsCard } from "@/lib/fsrs";
import { renderMarkdown } from "@/lib/markdown";
import type { MediaItem, QueueCard } from "@/lib/types";
import { CardRenderer, ASPECT } from "@/components/card-renderer";
import { Lightbox } from "@/components/card-media";
import { gradeCard, undoReview, type GradeResult } from "./actions";

/** Карточка, провалившаяся сейчас, возвращается в этой же сессии (§8.1). */
const RELEARN_HORIZON_MS = 20 * 60 * 1000;
const RELEARN_GAP = 3;



type HistoryEntry = { card: QueueCard; pending: Promise<GradeResult> };

export function ReviewSession({
  initialQueue,
  requestRetention,
  free,
}: {
  initialQueue: QueueCard[];
  requestRetention: number;
  free: boolean;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<MediaItem | null>(null);
  const history = useRef<HistoryEntry[]>([]);
  // заполняется эффектом при показе карточки: Date.now() в теле рендера — нечистый вызов
  const shownAt = useRef(0);

  const current = queue[0];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [current?.card.id, revealed]);

  const previews = useMemo(
    () => (current ? previewIntervals(current.scheduling, requestRetention) : null),
    [current, requestRetention],
  );

  const frontHtml = useMemo(
    () => (current ? renderMarkdown(current.card.front_md) : ""),
    [current],
  );
  const backHtml = useMemo(() => (current ? renderMarkdown(current.card.back_md) : ""), [current]);
  const noteHtml = useMemo(
    () => (current?.card.note_md ? renderMarkdown(current.card.note_md) : ""),
    [current],
  );

  const frontMedia = useMemo(
    () => (current?.media ?? []).filter((m) => m.side === "front"),
    [current],
  );
  const backMedia = useMemo(
    () => (current?.media ?? []).filter((m) => m.side === "back"),
    [current],
  );

  // Изображения двух следующих карточек подгружаются заранее (NFR-3),
  // иначе после оценки экран моргает пустым местом
  useEffect(() => {
    for (const next of queue.slice(1, 3)) {
      for (const image of next.media) {
        const preload = new Image();
        preload.src = image.url;
      }
    }
  }, [queue]);

  const grade = useCallback(
    (rating: Grade) => {
      if (!current) return;
      const now = new Date();
      const { card: after } = scheduler(requestRetention).next(
        toFsrsCard(current.scheduling),
        now,
        rating,
      );
      const nextScheduling = { ...current.scheduling, ...fromFsrsCard(current.card.id, after) };

      // Оптимистично: интерфейс не ждёт сервера (NFR-2), но истина — ответ действия
      const pending = gradeCard(current.card.id, rating, Date.now() - shownAt.current);
      pending.then((res) => {
        if (!res.ok) setError(res.error);
      });
      history.current.push({ card: current, pending });

      setQueue((prev) => {
        const rest = prev.slice(1);
        const dueIn = new Date(nextScheduling.due).getTime() - now.getTime();
        if (!free && dueIn < RELEARN_HORIZON_MS) {
          const at = Math.min(RELEARN_GAP, rest.length);
          return [
            ...rest.slice(0, at),
            { ...current, scheduling: nextScheduling },
            ...rest.slice(at),
          ];
        }
        return rest;
      });
      setRevealed(false);
      setDone((d) => d + 1);
    },
    [current, free, requestRetention],
  );

  const undo = useCallback(async () => {
    const last = history.current.pop();
    if (!last) return;
    const res = await last.pending;
    if (res.ok) {
      const undone = await undoReview(res.reviewId);
      if (!undone.ok) {
        setError(undone.error ?? "Could not undo");
        return;
      }
    }
    setQueue((prev) => [last.card, ...prev.filter((c) => c.card.id !== last.card.card.id)]);
    setRevealed(false);
    setDone((d) => Math.max(0, d - 1));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName))
        return;
      if (zoomed) {
        // во весь экран оценки не ставим — иначе слепое нажатие пробела
        if (event.key === "Escape") setZoomed(null);
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "я") {
        event.preventDefault();
        void undo();
        return;
      }
      if (revealed) {
        const rating = RATINGS.find((r) => r.key === event.key);
        if (rating) {
          event.preventDefault();
          grade(rating.grade);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, revealed, undo, zoomed]);

  // Свайп: влево — «Снова», вправо — «Хорошо» (§11)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    const t = event.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start || !revealed || zoomed) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) grade(dx < 0 ? 1 : 3);
    touchStart.current = null;
  };

  if (!current) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {free ? "Practice finished" : "Session finished"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {done > 0 ? `Cards graded: ${done}` : "Nothing is due right now"}
        </p>

        {/* Пустая очередь — это не тупик: расписание отодвинуло карточки вперёд,
            но повторить их вне расписания можно в любой момент. */}
        {!free && (
          <p className="mt-4 text-sm text-muted">
            Cards you graded moved into the future — that is what spaced repetition does. To go
            through them again anyway, use free practice: it ignores the schedule and leaves it
            untouched.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {!free && (
            <Link
              href="/review?free=1"
              className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink"
            >
              Practice again
            </Link>
          )}
          <Link
            href="/"
            className={`rounded-lg px-5 py-3 text-sm ${
              free
                ? "bg-accent font-medium text-accent-ink"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            Back to Today
          </Link>
          <Link
            href="/decks"
            className="rounded-lg border border-line px-5 py-3 text-sm text-muted hover:text-ink"
          >
            Browse decks
          </Link>
          {done > 0 && (
            <button
              type="button"
              onClick={() => void undo()}
              className="rounded-lg border border-line px-5 py-3 text-sm text-muted hover:text-ink"
            >
              Undo last grade
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {zoomed && <Lightbox image={zoomed} onClose={() => setZoomed(null)} />}
      <div className="flex items-center justify-between gap-4 border-b border-line pb-3 font-mono text-[11px] uppercase tracking-[0.13em] text-faint">
        <span className="truncate">{current.topicPath ?? "No topic"}</span>
        <span className="tabular-nums">
          {done} / {done + queue.length}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flip-scene flex flex-1 flex-col items-center justify-center gap-4 py-5">
        {/* Клик по полотну переворачивает карточку. Это div, а не button:
            внутри лежат кнопки изображений, а кнопку в кнопку вкладывать нельзя. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={revealed ? "Show the question" : "Show the answer"}
          onClick={() => setRevealed((r) => !r)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setRevealed((r) => !r);
          }}
          className="mx-auto w-full max-w-2xl cursor-pointer"
          style={{ aspectRatio: ASPECT[current.card.shape], maxHeight: "60dvh" }}
        >
          <div className="flip-inner" data-flipped={revealed}>
            {/* обе грани рисует тот же компонент, что и предпросмотр в редакторе */}
            <CardRenderer
              fill
              className="flip-face flip-face--front"
              shape={current.card.shape}
              layout={current.card.layout}
              imagePosition={current.card.image_position}
              html={frontHtml}
              images={frontMedia}
              onImageClick={() => setZoomed(frontMedia[0] ?? null)}
            />
            <CardRenderer
              fill
              className="flip-face flip-face--back"
              shape={current.card.shape}
              layout={current.card.layout}
              imagePosition={current.card.image_position}
              html={backHtml + noteHtml}
              images={backMedia}
              onImageClick={() => setZoomed(backMedia[0] ?? null)}
            />
          </div>
        </div>

        {current.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-1.5">
            {current.tags.map((tag) => (
              <li
                key={tag}
                className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-faint"
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-4 flex flex-col gap-2 sm:bottom-6">
        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="min-h-14 rounded bg-accent px-5 text-base font-medium text-accent-ink"
          >
            Flip the card
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((rating) => (
              <button
                key={rating.grade}
                type="button"
                onClick={() => grade(rating.grade)}
                className="min-h-14 rounded border border-line-strong bg-surface px-2 py-2 text-sm font-medium hover:border-accent hover:text-accent"
              >
                <span className="block">{rating.label}</span>
                <span className="block font-mono text-[11px] font-normal tabular-nums text-faint">
                  {previews?.[rating.grade]}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 text-[13px] text-faint">
          <button
            type="button"
            onClick={() => void undo()}
            disabled={done === 0}
            className="py-2 disabled:opacity-40"
          >
            Undo
          </button>
          <Link href={`/cards/${current.card.id}`} className="py-2 hover:text-ink">
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
