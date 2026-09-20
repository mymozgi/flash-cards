"use client";

import { useId } from "react";

/**
 * Пояснение к полю, спрятанное за значком.
 *
 * До него объяснение жило прямо в подписи: «Note — shown only after the
 * answer», «Source — where this came from». Подпись при этом переставала
 * отвечать на свой единственный вопрос «что это за поле» и превращалась в
 * предложение, которое читают один раз, а занимает оно место всегда.
 *
 * Показывается и по наведению, и по фокусу с клавиатуры: подсказка, доступная
 * только мыши, для половины способов ввода не существует. Поэтому это кнопка,
 * а не span — в обход табуляции значок был бы недостижим.
 *
 * Видимость держится на CSS, а не на состоянии: состояние здесь потребовало
 * бы эффекта на каждое наведение, а ответ и так целиком выражается селектором.
 *
 * Слой всплывает над содержимым (`absolute`), поэтому появление не сдвигает
 * ни подпись, ни поле под ней.
 */
export function Hint({ children }: { children: React.ReactNode }) {
  const id = useId();

  return (
    <span className="group relative inline-flex align-middle">
      {/*
        Видимый кружок — внутри, поле для попадания — снаружи. Раньше рамка и
        отступ висели на одном элементе, и отступ растягивал сам кружок: он
        выходил вдвое крупнее подписи, рядом с которой стоит.

        Цель нажатия меньше 44 px намеренно: нажимать тут нечего, кнопка нужна
        ради фокуса и наведения, а наведение ловит весь значок с полем вокруг.
      */}
      <button
        type="button"
        aria-describedby={id}
        aria-label="What is this field for?"
        className="-m-1.5 flex p-1.5 text-faint transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span
          aria-hidden
          className="grid size-3.5 place-items-center rounded-full border border-current text-[0.5625rem] font-bold leading-none"
        >
          ?
        </span>
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-normal leading-snug text-muted opacity-0 shadow-overlay transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      >
        {children}
      </span>
    </span>
  );
}
