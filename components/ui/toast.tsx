"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Сколько висит сообщение. Достаточно прочесть, мало чтобы мешать. */
const LIFETIME_MS = 4000;

/**
 * Короткое сообщение о том, что действие состоялось.
 *
 * Нужно там, где результат не виден сам по себе. Удалённый набор исчезает с
 * экрана — и это можно принять за сбой отрисовки, если ничего не сказано.
 *
 * `role="status"` и `aria-live="polite"` не украшение: без них исчезновение
 * набора для скринридера остаётся вообще незамеченным — объект просто
 * пропадает из дерева.
 *
 * Своё сообщение вместо общего провайдера: провайдер на всё приложение
 * понадобился бы, если бы сообщения приходили из несвязанных мест. Пока их
 * шлёт тот же экран, что и показывает, лишний слой ничего не даёт.
 */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    setText(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), LIFETIME_MS);
  }, []);

  // Таймер переживал бы размонтирование и дёргал бы состояние мёртвого узла
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toast = (
    /*
      Живёт поверх страницы и не двигает её содержимое. Снизу по центру: там
      он не накрывает то, с чем только что работали, и не спорит с шапкой.
      Отступ снизу учитывает панель жестов на iPhone.
    */
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      {text && (
        <p className="max-w-[min(28rem,100%)] rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-overlay">
          {text}
        </p>
      )}
    </div>
  );

  return { show, toast };
}
