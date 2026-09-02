"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { CardRenderer, type CardImage, type CardLayout, type CardShape, type ImagePosition } from "@/components/card-renderer";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, GridIcon } from "@/components/icons";
import { AXIS_SLOP, followX, swipeVerdict } from "@/lib/swipe";
import { Button, LinkButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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

  /**
   * Свайп на указателях, а не на касаниях: одна ветка кода на палец, мышь и
   * перо. Карточка идёт за пальцем, а решение «зачесть или вернуть» принимает
   * чистая функция — её можно проверить тестом, в отличие от жеста.
   */
  const scene = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; at: number; axis: "?" | "x" | "y" } | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), axis: "?" };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const moveX = e.clientX - g.x;
    const moveY = e.clientY - g.y;

    if (g.axis === "?") {
      // Ось выбирается один раз и навсегда. Пока она не выбрана, жест ничей:
      // так вертикальная прокрутка не превращается в листание на полпути.
      if (Math.abs(moveX) < AXIS_SLOP && Math.abs(moveY) < AXIS_SLOP) return;
      g.axis = Math.abs(moveX) > Math.abs(moveY) ? "x" : "y";
      if (g.axis === "y") {
        gesture.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    setDx(followX(moveX, atFirst, atLast));
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    setDx(0);
    if (!g || g.axis !== "x") return;
    const verdict = swipeVerdict({
      dx: e.clientX - g.x,
      dy: e.clientY - g.y,
      width: scene.current?.offsetWidth ?? window.innerWidth,
      elapsed: performance.now() - g.at,
      atFirst,
      atLast,
    });
    if (verdict === "next") go(1);
    if (verdict === "prev") go(-1);
  };

  const frontHtml = useMemo(() => (card ? renderMarkdown(card.term) : ""), [card]);
  const answerHtml = useMemo(() => (card ? renderMarkdown(card.answer) : ""), [card]);

  if (!card) {
    return (
      <div className="rounded-xl border border-line bg-surface p-10 text-center">
        <p className="text-sm text-muted">This deck has no cards yet.</p>
        <LinkButton href={`/decks/${deckId}`} tone="primary" className="mt-4">
          Open the constructor
        </LinkButton>
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
        <Button size="sm" onClick={shuffle} aria-pressed={shuffled}>
          <GridIcon className="size-3.5" />
          Shuffle
        </Button>
      </div>

      <Progress value={at + 1} max={total} label={`Card ${at + 1} of ${total}`} />

      <div
        ref={scene}
        className="deck-scene relative mx-auto w-full max-w-2xl touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        {/* слои позади: видно, что карточка лежит в стопке */}
        {!atLast && (
          <>
            <div className="deck-stack-layer" style={{ transform: "translateY(10px) scale(0.965)" }} />
            <div className="deck-stack-layer" style={{ transform: "translateY(20px) scale(0.93)" }} />
          </>
        )}
        {/* Пока палец ведёт — карточка следует за ним и слегка гаснет, чтобы
            было видно: жест засчитывается, а не проваливается в пустоту.
            Отпустили — пружина назад за 200 мс. */}
        <div
          key={step}
          className={`deck-card relative ${dragging ? "" : "transition-transform duration-200 motion-reduce:transition-none"}`}
          data-dir={dragging ? undefined : dir}
          style={
            dx === 0
              ? undefined
              : {
                  transform: `translate3d(${dx}px, 0, 0) rotate(${dx * 0.015}deg)`,
                  opacity: Math.max(0.55, 1 - Math.abs(dx) / 700),
                }
          }
        >
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

      <div className="flex items-center justify-center gap-3">
        {/* Та же пара стрелок, что и в повторении: один элемент управления на
            обоих экранах, где листают карточки. Счётчик стоит между ними —
            рядом с тем, что его двигает. */}
        <Button
          size="icon"
          onClick={() => go(-1)}
          disabled={atFirst}
          aria-label="Previous card"
        >
          <ArrowLeftIcon />
        </Button>
        <span className="label-micro min-w-20 text-center tabular-nums">
          {at + 1} / {total}
        </span>
        <Button size="icon" onClick={() => go(1)} disabled={atLast} aria-label="Next card">
          <ArrowRightIcon />
        </Button>
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
