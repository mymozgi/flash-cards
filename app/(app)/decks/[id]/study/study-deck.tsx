"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { CardRenderer, type CardImage, type CardLayout, type CardShape, type ImagePosition } from "@/components/card-renderer";
import { CloseIcon, GridIcon } from "@/components/icons";

export type StudyCard = {
  id: string;
  term: string;
  answer: string;
  example: string;
  shape: CardShape;
  layout: CardLayout;
  imagePosition: ImagePosition;
  frontImages: CardImage[];
  backImages: CardImage[];
};

/**
 * Просмотр колоды: карточки листаются кнопками Previous и Next.
 * Переворота здесь нет намеренно — это режим знакомства с материалом,
 * а не проверки себя; проверка живёт на экране повторения.
 */
export function StudyDeck({
  deckName,
  cards,
  deckId,
}: {
  deckName: string;
  cards: StudyCard[];
  deckId: string;
}) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [shuffled, setShuffled] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  // ключ перезапускает анимацию: без него повторный переход не проигрывается.
  // Это состояние, а не ref: ref нельзя читать во время отрисовки.
  const [step, setStep] = useState(0);

  const card = cards[order[at]];
  const total = order.length;
  const atFirst = at === 0;
  const atLast = at === total - 1;

  const go = useCallback(
    (delta: number) => {
      setAt((prev) => {
        const next = Math.min(total - 1, Math.max(0, prev + delta));
        if (next !== prev) {
          setDir(delta > 0 ? "next" : "prev");
          setStep((n) => n + 1);
        }
        return next;
      });
    },
    [total],
  );

  const shuffle = () => {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setAt(0);
    setShuffled(true);
    setStep((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "Escape") setZoomed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const frontHtml = useMemo(() => (card ? renderMarkdown(card.term) : ""), [card]);
  const answerHtml = useMemo(() => (card ? renderMarkdown(card.answer) : ""), [card]);

  if (!card) {
    return (
      <div className="rounded-xl border border-line bg-surface p-10 text-center">
        <p className="text-sm text-muted">This deck has no cards yet.</p>
        <Link
          href={`/decks/${deckId}`}
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink"
        >
          Open the constructor
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image"
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 p-4"
        >
          <img src={zoomed} alt="" className="max-h-[85dvh] max-w-full object-contain" />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link href={`/decks/${deckId}`} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
          <CloseIcon />
          <span className="truncate">{deckName}</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted">
            {at + 1} / {total}
          </span>
          <button
            type="button"
            onClick={shuffle}
            aria-pressed={shuffled}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            <GridIcon className="size-3.5" />
            Shuffle
          </button>
        </div>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${((at + 1) / total) * 100}%` }}
        />
      </div>

      <div
        className="deck-scene relative mx-auto w-full max-w-2xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* слои позади: видно, что карточка лежит в стопке */}
        {!atLast && (
          <>
            <div className="deck-stack-layer" style={{ transform: "translateY(10px) scale(0.965)" }} />
            <div className="deck-stack-layer" style={{ transform: "translateY(20px) scale(0.93)" }} />
          </>
        )}
        <div key={step} className="deck-card relative" data-dir={dir}>
          <CardRenderer
            shape={card.shape}
            layout={card.layout}
            imagePosition={card.imagePosition}
            html={frontHtml}
            images={card.frontImages}
            maxHeight="58dvh"
            onImageClick={() => setZoomed(card.frontImages[0]?.url ?? null)}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={atFirst}
          className="min-h-12 flex-1 rounded-lg border border-line px-5 text-sm disabled:opacity-40 sm:flex-none sm:min-w-32"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={atLast}
          className="min-h-12 flex-1 rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-40 sm:flex-none sm:min-w-32"
        >
          Next
        </button>
      </div>

      {/* Ответ виден сразу: переворота в этом режиме нет */}
      <section className="mx-auto w-full max-w-2xl rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted">Answer</h2>
        <div className="prose-card mt-2" dangerouslySetInnerHTML={{ __html: answerHtml }} />
        {card.backImages.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {card.backImages.map((image) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setZoomed(image.url)}
                className="overflow-hidden rounded-lg border border-line"
              >
                <img src={image.url} alt={image.caption ?? ""} className="h-40 w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {card.example && <p className="mt-2 text-sm italic text-muted">{card.example}</p>}
      </section>

      <p className="text-center text-xs text-faint">
        Arrows or swipe move between cards · flip-based self-testing lives in Review
      </p>
    </div>
  );
}
