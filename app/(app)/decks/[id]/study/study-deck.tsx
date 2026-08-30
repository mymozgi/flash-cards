"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import type { MediaItem } from "@/lib/types";
import { CloseIcon, GridIcon } from "@/components/icons";

export type StudyCard = {
  id: string;
  term: string;
  answer: string;
  example: string;
  link: string;
  shape: "square" | "landscape" | "portrait";
  media: MediaItem[];
};

/**
 * Пропорции полотна. 16:9 намеренно нет: на телефоне такая карточка
 * превращается в полоску, где не помещается ни картинка, ни текст.
 */
const ASPECT: Record<StudyCard["shape"], string> = {
  square: "1 / 1",
  landscape: "3 / 2",
  portrait: "2 / 3",
};

export function StudyDeck({ deckName, cards, deckId }: { deckName: string; cards: StudyCard[]; deckId: string }) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);

  const card = cards[order[at]];
  const total = order.length;

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setAt((prev) => Math.min(total - 1, Math.max(0, prev + delta)));
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
    setFlipped(false);
    setShuffled(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((f) => !f);
      }
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Свайп по карточке листает колоду; вертикальное движение не мешает скроллу
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

  const front = useMemo(() => card?.media.filter((m) => m.side === "front") ?? [], [card]);
  const back = useMemo(() => card?.media.filter((m) => m.side === "back") ?? [], [card]);

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

      <div className="flip-scene mx-auto w-full max-w-2xl" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Show the question" : "Show the answer"}
          className="block w-full text-left"
          style={{ aspectRatio: ASPECT[card.shape], maxHeight: "68dvh" }}
        >
          <div className="flip-inner" data-flipped={flipped}>
            <Face
              className="flip-face--front"
              text={card.term}
              images={front}
              hint="Tap to flip"
            />
            <Face
              className="flip-face--back"
              text={card.answer}
              images={back}
              example={card.example}
              link={card.link}
              accent
            />
          </div>
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={at === 0}
          className="min-h-12 min-w-24 rounded-lg border border-line px-5 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="min-h-12 flex-1 rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink sm:flex-none sm:min-w-40"
        >
          {flipped ? "Question" : "Flip"}
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={at === total - 1}
          className="min-h-12 min-w-24 rounded-lg border border-line px-5 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <p className="text-center text-xs text-faint">
        Space flips · arrows move · swipe left and right on a phone
      </p>
    </div>
  );
}

function Face({
  className,
  text,
  images,
  example,
  link,
  hint,
  accent,
}: {
  className: string;
  text: string;
  images: MediaItem[];
  example?: string;
  link?: string;
  hint?: string;
  accent?: boolean;
}) {
  const html = useMemo(() => renderMarkdown(text), [text]);

  return (
    <div
      className={`flip-face rounded-2xl border p-4 sm:p-6 ${className} ${
        accent ? "border-accent bg-accent-soft" : "border-line bg-surface"
      } shadow-sm`}
    >
      {images.length > 0 && (
        <div className={`mb-3 grid min-h-0 flex-1 gap-2 ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.map((image) => (
            // обычный img: файлы уже сжаты клиентом, оптимизация Vercel лимитирована
            <img
              key={image.id}
              src={image.url}
              alt={image.caption ?? ""}
              className="h-full w-full rounded-lg object-contain"
            />
          ))}
        </div>
      )}

      <div
        className={`prose-card min-h-0 overflow-y-auto ${
          images.length > 0 ? "text-base" : "flex-1 text-lg sm:text-2xl"
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {example && <p className="mt-2 shrink-0 text-sm italic text-muted">{example}</p>}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 shrink-0 truncate text-sm text-accent underline underline-offset-4"
        >
          {link}
        </a>
      )}

      {hint && <p className="mt-2 shrink-0 text-center text-xs text-faint">{hint}</p>}
    </div>
  );
}
