"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Grade } from "ts-fsrs";
import { fromFsrsCard, previewIntervals, RATINGS, scheduler, toFsrsCard } from "@/lib/fsrs";
import { renderMarkdown } from "@/lib/markdown";
import type { MediaItem, QueueCard } from "@/lib/types";
import { CardRenderer, ASPECT } from "@/components/card-renderer";
import { Lightbox } from "@/components/card-media";
import { Button, LinkButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TagChip } from "@/components/ui/tag-chip";
import { ArrowLeftIcon, ArrowRightIcon, FlipIcon } from "@/components/icons";
import {
  nextSpan,
  queueAfterGrade,
  queueAfterSkip,
  RELEARN_HORIZON_MS,
  SKIP_LIMIT,
} from "@/lib/session";
import { gradeCard, undoReview, type GradeResult } from "./actions";

type HistoryEntry = { card: QueueCard; pending: Promise<GradeResult>; relearn: boolean };

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
  /**
   * Знаменатель полосы прогресса. Не `done + queue.length`, потому что очередь
   * растёт: проваленная карточка возвращается в эту же сессию. Здесь копится
   * наибольшая работа, какую сессия себя показала, — так полоса не дёргается
   * от каждого провала.
   */
  const [span, setSpan] = useState(initialQueue.length);
  /** Часть уже сделанного, что пришлось переучивать. Рисуется янтарным. */
  const [lapses, setLapses] = useState(0);
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

  /** Полосу нужно не только видеть: без этого скринридер скажет «графика». */
  const progressLabel = useMemo(
    () =>
      lapses > 0
        ? `${done} of ${span} cards graded, ${lapses} sent back to relearn`
        : `${done} of ${span} cards graded`,
    [done, lapses, span],
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
      const dueIn = new Date(nextScheduling.due).getTime() - now.getTime();
      const relearn = !free && dueIn < RELEARN_HORIZON_MS;
      history.current.push({ card: current, pending, relearn });

      setQueue((prev) => queueAfterGrade(prev, relearn, { ...current, scheduling: nextScheduling }));
      setRevealed(false);
      setDone((d) => d + 1);
      // Карточка вернулась — работы в сессии стало на одну больше, и эта одна
      // честно помечена как повторная
      if (relearn) {
        setSpan((n) => nextSpan(n, done, "relearn"));
        setLapses((n) => n + 1);
      }
    },
    [current, done, free, requestRetention],
  );

  /**
   * Пропуск: карточка уезжает в конец очереди без оценки. Расписание при этом
   * не трогается вовсе — в том и смысл: «сейчас не хочу» не то же самое, что
   * «не помню», и алгоритму об этом знать нечего.
   */
  const skips = useRef(new Map<string, number>());
  const skip = useCallback(() => {
    if (!current || queue.length < 2) return;
    const times = (skips.current.get(current.card.id) ?? 0) + 1;
    skips.current.set(current.card.id, times);
    const drop = times >= SKIP_LIMIT;
    setQueue((prev) => queueAfterSkip(prev, times));
    // выбывшая карточка перестаёт быть работой этой сессии — иначе полоса
    // никогда не дойдёт до конца
    if (drop) setSpan((n) => nextSpan(n, done, "skip-drop"));
    setRevealed(false);
  }, [current, done, queue.length]);

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
    // `span` не уменьшаем: это отметка наибольшей работы, а не текущий счёт
    if (last.relearn) setLapses((n) => Math.max(0, n - 1));
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
      if (
        event.key.toLowerCase() === "z" ||
        event.key.toLowerCase() === "я" ||
        event.key === "ArrowLeft"
      ) {
        event.preventDefault();
        void undo();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        skip();
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
  }, [grade, revealed, skip, undo, zoomed]);

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
            <LinkButton href="/review?free=1" tone="primary" size="lg">
              Practice again
            </LinkButton>
          )}
          <LinkButton href="/" tone={free ? "primary" : "secondary"} size="lg">
            Back to Today
          </LinkButton>
          <LinkButton href="/decks" size="lg">
            Browse decks
          </LinkButton>
          {done > 0 && (
            <Button size="lg" onClick={() => void undo()}>
              Undo last grade
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {zoomed && <Lightbox image={zoomed} onClose={() => setZoomed(null)} />}
      <div className="flex items-center justify-between gap-4 pb-2.5">
        <span className="label-micro truncate">{current.topicPath ?? "No topic"}</span>
        <span className="label-micro tabular-nums">
          {done} / {span}
        </span>
      </div>
      <Progress
        value={done}
        max={span}
        warn={lapses}
        label={progressLabel}
      />

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
          <ul className="mt-6 flex flex-wrap gap-2">
            {current.tags.map((tag) => (
              <li key={tag}>
                <TagChip name={tag} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-4 flex flex-col gap-2 sm:bottom-6">
        {revealed && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((rating) => (
              <button
                key={rating.grade}
                type="button"
                onClick={() => grade(rating.grade)}
                className="min-h-14 rounded-lg border-control border-field-line bg-surface px-2 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
              >
                <span className="block">{rating.label}</span>
                <span className="block font-mono text-2xs font-normal tabular-nums text-faint">
                  {previews?.[rating.grade]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/*
          Переворот перестал быть плитой во всю ширину: он занимает столько,
          сколько занимает его подпись. По бокам — шаг назад и шаг вперёд.
          «Предыдущей карточки» в повторении не существует, очередь
          односторонняя, поэтому стрелка назад делает единственное честное:
          отменяет последнюю оценку. Стрелка вперёд откладывает карточку в
          конец очереди, не оценивая её.
        */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            onClick={() => void undo()}
            disabled={done === 0}
            aria-label="Back — undo the last grade"
            title="Undo the last grade"
          >
            <ArrowLeftIcon />
          </Button>
          <Button tone="soft" onClick={() => setRevealed((r) => !r)} className="min-w-48">
            <FlipIcon />
            {revealed ? "Show the question" : "Flip the card"}
          </Button>
          <Button
            size="icon"
            onClick={skip}
            disabled={queue.length < 2}
            aria-label="Skip — move this card to the end without grading"
            title="Skip without grading"
          >
            <ArrowRightIcon />
          </Button>
        </div>

        <div className="flex justify-end text-sm text-faint">
          {/* Правка живёт в конструкторе колоды: другого редактора больше нет */}
          <Link
            href={current.card.topic_id ? `/decks/${current.card.topic_id}` : "/library"}
            className="py-2 hover:text-ink"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
