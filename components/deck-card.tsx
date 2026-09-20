"use client";

import Link from "next/link";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/panel";
import { MoreIcon, PlusIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { COVER_ASPECT } from "@/lib/image";
import { withOrigin } from "@/lib/back";
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
  onOpenMenu,
  from,
}: {
  deck: DeckSummary;
  /** Гостевой режим: тренировка пишет оценки, правка меняет данные — обе скрыты. */
  readOnly?: boolean;
  /* Режим выбора нужен только списку наборов. На «Сегодня» карточка
     показывается без него — из серверного компонента функцию-заглушку
     передать нельзя, туда уезжают только серверные действия. */
  selecting?: boolean;
  selected?: boolean;
  /* Без обработчика кнопки меню нет: кнопка, которая ничего не делает, хуже
     её отсутствия, а действия над набором осмысленны не на каждом экране. */
  onOpenMenu?: (anchor: { x: number; y: number }) => void;
  onToggle?: () => void;
  /** Откуда открыли плитку: набор вернёт человека сюда же. */
  from?: string;
}) {
  const ratio = deck.total === 0 ? 0 : Math.round((deck.memorized / deck.total) * 100);
  const tint = deck.color || "var(--accent)";
  const open = from ? withOrigin(`/decks/${deck.id}`, from) : `/decks/${deck.id}`;

  return (
    /*
      Плитка — один интерактивный объект, а не набор кнопок. Нажатие по ней
      открывает набор; отдельные Browse и Edit внизу это дублировали и
      отнимали место у единственного главного действия.

      Приподнимается при наведении — но только там, где наведение вообще
      бывает: на касании hover залипает после нажатия, и плитка остаётся
      поднятой без причины.
    */
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-200 hover:[@media(hover:hover)]:-translate-y-0.5 hover:[@media(hover:hover)]:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      {/*
        Полоса есть всегда — на ней держится равная высота плиток.

        Своего скругления у неё нет: карточка уже скруглена и обрезает
        содержимое, а второй радиус поверх первого оставлял в углу зазубрину.

        Обложка вписывается целиком, а не заполняет полосу. Обложки здесь —
        схемы и иллюстрации, у них срезанный край отнимает смысл, а не поля.
        Пустое место по бокам залито тем же тоном, что и заглушка, поэтому
        читается как подложка, а не как промах вёрстки.
      */}
      <div
        className="relative -mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)] overflow-hidden"
        style={{
          aspectRatio: COVER_ASPECT,
          background: `color-mix(in srgb, ${tint} 12%, var(--surface))`,
        }}
      >
        {deck.cover ? (
          /*
            Вписывание по высоте: картинка занимает полосу целиком сверху
            донизу, а по горизонтали либо не достаёт до краёв, либо выходит за
            них и обрезается по центру. Так у высокой иллюстрации ничего не
            срезается по вертикали — а именно там у схем и обложек смысл.

            Абсолютное положение, а не элемент сетки: у элемента сетки высота
            в процентах не от чего считать, и картинка вставала в натуральную
            величину — на плитке это выглядело как многократное увеличение.
            `inset-0` даёт определённую высоту, `m-auto` центрует.
          */
          <img
            src={deck.cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 m-auto h-full w-auto max-w-none"
          />
        ) : (
          /*
            Заглушка несёт первую букву названия. Ровный серый прямоугольник
            занимал бы столько же места и не сообщал ничего; здесь то же место
            работает опознавательным знаком, пока обложки нет.
          */
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center font-display text-5xl font-semibold leading-none"
            style={{ color: `color-mix(in srgb, ${tint} 45%, var(--surface))` }}
          >
            {deck.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        {/*
          Пилюля называет РОДИТЕЛЬСКУЮ категорию, поэтому у набора без родителя
          её нет вовсе. Прежнее «No category» читалось как незаполненное
          свойство, которое надо бы заполнить, — а заполнять там нечего: набор
          лежит в корне, и это законное место, а не пробел.
        */}
        {deck.category ? (
          <Badge
            style={deck.color ? { background: `${deck.color}22`, color: deck.color } : undefined}
          >
            {deck.category}
          </Badge>
        ) : (
          <span />
        )}
        {selecting && !readOnly ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle?.()}
            aria-label={`Select ${deck.name}`}
            className="size-4 accent-[var(--accent)]"
          />
        ) : null}
      </div>

      <div className="mt-3">
        {/*
          Ссылка растянута на всю плитку невидимым слоем. Так нажатие по
          обложке, имени и пустому месту ведёт в набор, а кнопки снизу лежат
          выше слоя и перехватывают своё нажатие сами.

          В режиме выбора слоя нет: там нажатие означает «отметить», и
          уводить с экрана оно не должно.
        */}
        {!selecting && (
          <Link href={open} className="absolute inset-0 z-0" aria-label={`Open ${deck.name}`}>
            <span className="sr-only">Open {deck.name}</span>
          </Link>
        )}
        <h2 className={`${titleSize(deck.name)} line-clamp-2 font-semibold leading-tight`}>
          {deck.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {deck.description || "No description"}
        </p>
      </div>

      {/*
        Пустой набор — не поломка, а начало: структуру заводят раньше, чем
        наполняют. Полоса прогресса 0 из 0 ему ничего не сообщает, поэтому
        вместо неё сказано прямо, чего не хватает.
      */}
      {deck.total === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-faint">
          No cards in this set yet
        </p>
      ) : (
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
      )}

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

      {/*
        Одно главное действие и меню. Browse и Edit отсюда убраны: нажатие
        по самой плитке открывает набор, где есть и то и другое, а три
        равноправные кнопки в ряду не давали понять, какая из них главная.

        `relative z-10` поднимает ряд над слоем-ссылкой: иначе нажатие на
        Practice открывало бы набор.
      */}
      <div className="relative z-10 mt-4 flex items-stretch gap-2">
        {readOnly ? (
          <LinkButton href={`/decks/${deck.id}/study`} tone="soft" className="flex-1">
            Browse cards
          </LinkButton>
        ) : deck.total === 0 ? (
          /* Практиковать нечего. Единственное осмысленное действие у пустого
             набора — наполнить его, и оно же главное. */
          <LinkButton href={open} tone="primary" className="flex-1">
            <PlusIcon />
            Add cards
          </LinkButton>
        ) : (
          <LinkButton href={`/review?free=1&topic=${deck.id}`} tone="soft" className="flex-1">
            Practice
          </LinkButton>
        )}
        {!readOnly && onOpenMenu && (
          <Button
            size="icon"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              onOpenMenu({ x: box.right - 224, y: box.bottom });
            }}
            aria-haspopup="menu"
            aria-label={`Actions for ${deck.name}`}
            title="Open, browse, edit, move cards, archive, delete…"
          >
            <MoreIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
