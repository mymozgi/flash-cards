"use client";

import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/panel";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import type { DeckSummary } from "@/lib/types";

export type { DeckSummary };

/**
 * Кегль названия по его длине.
 *
 * Измерять ширину в эффекте было бы точнее, но за это платят вспышкой: текст
 * успевает отрисоваться крупным и прыгает на втором проходе — на сетке из
 * двенадцати плиток это заметно. Длина в знаках — оценка грубее, зато решение
 * принимается до первой отрисовки.
 *
 * Нижняя ступень намеренно не мельче 16 px и остаётся полужирной: название,
 * потерявшее вес и размер, перестаёт читаться как название и сливается с
 * описанием под ним.
 */
function titleSize(name: string): string {
  if (name.length <= 22) return "text-lg";
  if (name.length <= 40) return "text-base";
  return "text-base sm:text-[0.9375rem]";
}

/**
 * Карточка набора. Один компонент на два экрана — список наборов и «Сегодня»:
 * иначе они начнут расходиться, как уже разошлись два редактора карточки.
 */
export function DeckCard({
  deck,
  readOnly = false,
  selecting = false,
  selected = false,
  onToggle,
}: {
  deck: DeckSummary;
  /** Гостевой режим: тренировка пишет оценки, правка меняет данные — обе скрыты. */
  readOnly?: boolean;
  /* Режим выбора нужен только списку наборов. На «Сегодня» карточка
     показывается без него — из серверного компонента функцию-заглушку
     передать нельзя, туда уезжают только серверные действия. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const ratio = deck.total === 0 ? 0 : Math.round((deck.memorized / deck.total) * 100);
  const tint = deck.color || "var(--accent)";

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-surface p-5 shadow-card ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      {/* Полоса 16:9 есть всегда — на ней держится равная высота плиток. */}
      {deck.cover ? (
        <img
          src={deck.cover}
          alt=""
          loading="lazy"
          className="-mx-5 -mt-5 mb-4 aspect-video w-[calc(100%+2.5rem)] rounded-t-xl object-cover"
        />
      ) : (
        /*
          Заглушка тонирована цветом набора и несёт его первую букву. Ровный
          серый прямоугольник занимал бы столько же места и не сообщал ничего;
          здесь то же место работает опознавательным знаком, по которому набор
          находят взглядом, пока обложки нет.
        */
        <div
          aria-hidden
          className="-mx-5 -mt-5 mb-4 grid aspect-video w-[calc(100%+2.5rem)] place-items-center rounded-t-xl"
          style={{ background: `color-mix(in srgb, ${tint} 12%, var(--surface))` }}
        >
          <span
            className="font-display text-5xl font-semibold leading-none"
            style={{ color: `color-mix(in srgb, ${tint} 45%, var(--surface))` }}
          >
            {deck.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <Badge
          style={
            deck.color ? { background: `${deck.color}22`, color: deck.color } : undefined
          }
        >
          {deck.category ?? "No category"}
        </Badge>
        {selecting && !readOnly ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle?.()}
            aria-label={`Select ${deck.name}`}
            className="size-4 accent-[var(--accent)]"
          />
        ) : (
          <Link
            href={`/decks/${deck.id}`}
            aria-label={`Edit ${deck.name}`}
            className="text-faint hover:text-ink"
          >
            <TrashIcon className="size-4 opacity-0" />
          </Link>
        )}
      </div>

      <Link href={`/decks/${deck.id}`} className="mt-3 block">
        <h2 className={`${titleSize(deck.name)} line-clamp-2 font-semibold leading-tight`}>
          {deck.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {deck.description || "No description"}
        </p>
      </Link>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="label-micro">Cards memorized</span>
          <span className="text-xs font-semibold tabular-nums text-muted">
            {deck.memorized}/{deck.total}
          </span>
        </div>
        <Progress
          value={deck.memorized}
          max={deck.total}
          label={`${ratio}% memorized in ${deck.name}`}
          className="mt-1.5"
        />
      </div>

      {/* mt-auto прижимает подвал ко дну: плитки в ряду тянутся до общей
          высоты, и без этого кнопки вставали бы на разных уровнях. */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
        <span>
          {deck.total} {deck.total === 1 ? "card" : "cards"}
        </span>
        <span>
          {deck.lastUsed
            ? `Last used ${new Date(deck.lastUsed).toLocaleDateString()}`
            : "Not studied yet"}
        </span>
      </div>

      <div className="mt-4 flex items-stretch gap-2">
        {/* Practice — то, ради чего набор открывают. Он и должен выглядеть
            как главное действие, а правка и просмотр — как вспомогательные. */}
        {readOnly ? (
          <LinkButton href={`/decks/${deck.id}/study`} tone="soft" className="flex-1">
            Browse cards
          </LinkButton>
        ) : (
          <>
            <LinkButton href={`/review?free=1&topic=${deck.id}`} tone="soft" className="flex-1">
              Practice
            </LinkButton>
            <LinkButton href={`/decks/${deck.id}/study`} className="flex-1">
              Browse
            </LinkButton>
            {/* Правка — иконкой: подпись к ней ничего не добавляла, а место
                отнимала у двух действий, ради которых набор открывают. */}
            <LinkButton
              href={`/decks/${deck.id}`}
              size="icon"
              aria-label={`Edit ${deck.name}`}
              title="Edit"
            >
              <PencilIcon />
            </LinkButton>
          </>
        )}
      </div>
    </div>
  );
}
