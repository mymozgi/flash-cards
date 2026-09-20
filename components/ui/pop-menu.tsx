"use client";

import { useEffect, useRef } from "react";

export type PopMenuItem<T extends string> = {
  action: T;
  label: string;
  danger?: boolean;
};

export type PopMenuGroup<T extends string> = { items: PopMenuItem<T>[] };

/**
 * Всплывающее меню действий над объектом.
 *
 * Обвязка здесь общая, и это главное: закрытие по Escape, закрытие по клику
 * вне, прижатие к краю окна и перевод фокуса на первый пункт. Второе меню,
 * написанное рядом, повторило бы всё это — и разошлось бы на первой же
 * правке, а расходятся такие вещи молча: меню просто перестаёт закрываться
 * с клавиатуры, и никто этого не замечает.
 *
 * Состав пунктов у каждого объекта свой и приходит снаружи: у категории и у
 * набора разные действия, и общий список был бы списком «всё, что бывает».
 */
export function PopMenu<T extends string>({
  title,
  groups,
  at,
  onPick,
  onClose,
}: {
  /** Чей это набор действий. Видно в меню и слышно скринридеру. */
  title: string;
  groups: PopMenuGroup<T>[];
  at: { x: number; y: number };
  onPick: (action: T) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // capture: иначе клик успеет сработать на элементе под меню
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    box.current?.querySelector("button")?.focus();
  }, []);

  const visible = groups.filter((group) => group.items.length > 0);

  return (
    <div
      ref={box}
      role="menu"
      aria-label={`Actions for ${title}`}
      // Прижимаем к краю окна: у нижних объектов длинного списка меню иначе
      // раскрывалось бы за пределы экрана
      style={{
        left: Math.min(at.x, (typeof window === "undefined" ? 1024 : window.innerWidth) - 236),
        top: Math.min(at.y + 6, (typeof window === "undefined" ? 768 : window.innerHeight) - 340),
      }}
      className="fixed z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-overlay"
    >
      <p className="truncate px-3 py-2 label-micro">{title}</p>
      {visible.map((group, index) => (
        <div key={index} className={index > 0 ? "border-t border-line pt-1" : ""}>
          {group.items.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              onClick={() => onPick(item.action)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 ${
                item.danger ? "text-rust" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
