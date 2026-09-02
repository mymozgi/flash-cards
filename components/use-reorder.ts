"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Перетаскивание для смены порядка.
 *
 * Раньше здесь был HTML5 drag-and-drop. Его события не возникают от касания
 * ни в Safari на iOS, ни в Chrome на Android — то есть порядок карточек нельзя
 * было изменить с телефона вообще, при том что мобильная вёрстка в проекте
 * первична. Указательные события дают одну ветку кода на мышь, палец и перо.
 *
 * Клавиатура здесь не дополнение, а вторая половина задачи: у прежней ручки
 * был aria-label и ни одного способа ей воспользоваться без мыши.
 */

/** С касания перенос начинается по удержанию: иначе страница перестанет прокручиваться. */
const LONG_PRESS_MS = 250;
/** Сдвиг до срабатывания удержания отменяет перенос — палец вёл, а не держал. */
const MOVE_CANCEL_PX = 8;
/** Полоса у края экрана, в которой список едет сам. */
const EDGE_ZONE_PX = 72;
const EDGE_SPEED_PX = 12;
/** Столько же, сколько у переворота и у расступающихся соседей. */
const SHIFT_MS = 180;
const SHIFT_EASE = "cubic-bezier(.2,.7,.2,1)";

type Snapshot = { id: string; top: number; height: number };

type Drag = {
  id: string;
  from: number;
  to: number;
  /** Смещение за указателем. У клавиатурного переноса всегда 0. */
  dy: number;
  keyboard: boolean;
};

export function useReorder({
  ids,
  onMove,
  enabled = true,
  /** Сетка и «уменьшить движение»: соседи не расступаются, показывается место вставки. */
  simple = false,
}: {
  ids: string[];
  onMove: (from: number, to: number) => void;
  enabled?: boolean;
  simple?: boolean;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const nodes = useRef(new Map<string, HTMLElement>());
  const snapshot = useRef<Snapshot[]>([]);
  const shift = useRef(0);
  const origin = useRef({ docY: 0, centerY: 0 });
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const pointerClientY = useRef(0);
  const frame = useRef(0);
  const reduced = useMotionReduced();
  const flat = simple || reduced;

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(id, el);
      else nodes.current.delete(id);
    },
    [],
  );

  /** Снимок раскладки в координатах документа: прокрутка во время переноса её не сдвинет. */
  const measure = useCallback(
    (id: string) => {
      const list: Snapshot[] = [];
      for (const cardId of ids) {
        const el = nodes.current.get(cardId);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        list.push({ id: cardId, top: rect.top + window.scrollY, height: rect.height });
      }
      snapshot.current = list;

      const self = list.find((item) => item.id === id);
      const gap = gapOf(nodes.current.get(id));
      shift.current = (self?.height ?? 0) + gap;
      origin.current.centerY = self ? self.top + self.height / 2 : 0;
    },
    [ids],
  );

  const targetIndex = useCallback((centerY: number) => {
    const list = snapshot.current;
    let index = 0;
    for (let i = 0; i < list.length; i++) {
      if (centerY > list[i].top + list[i].height / 2) index = i;
    }
    return index;
  }, []);

  // ───────────────────────────────────────────── указатель

  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  const beginPointerDrag = useCallback(
    (id: string, index: number, clientY: number) => {
      measure(id);
      origin.current.docY = clientY + window.scrollY;
      setDrag({ id, from: index, to: index, dy: 0, keyboard: false });
    },
    [measure],
  );

  const grabProps = useCallback(
    (id: string, index: number) => {
      if (!enabled) return {};
      return {
        onPointerDown: (event: React.PointerEvent) => {
          if (event.button !== 0) return;
          const target = event.currentTarget as HTMLElement;
          target.setPointerCapture(event.pointerId);
          pointerClientY.current = event.clientY;

          if (event.pointerType === "mouse") {
            event.preventDefault();
            beginPointerDrag(id, index, event.clientY);
            return;
          }
          // палец и перо: сначала удержание, иначе прокрутка списка станет невозможной
          press.current = {
            x: event.clientX,
            y: event.clientY,
            timer: window.setTimeout(() => {
              press.current = null;
              beginPointerDrag(id, index, event.clientY);
            }, LONG_PRESS_MS),
          };
        },

        onPointerMove: (event: React.PointerEvent) => {
          pointerClientY.current = event.clientY;
          const waiting = press.current;
          if (waiting) {
            const moved =
              Math.abs(event.clientX - waiting.x) > MOVE_CANCEL_PX ||
              Math.abs(event.clientY - waiting.y) > MOVE_CANCEL_PX;
            if (moved) cancelPress();
            return;
          }
          // Считаем снаружи, а не в функции-обновителе: обновитель должен быть
          // чистым, в разработке React вызывает его дважды
          if (!drag || drag.keyboard || drag.id !== id) return;
          event.preventDefault();
          const dy = event.clientY + window.scrollY - origin.current.docY;
          setDrag({ ...drag, dy, to: targetIndex(origin.current.centerY + dy) });
        },

        onPointerUp: () => {
          cancelPress();
          if (!drag || drag.keyboard || drag.id !== id) return;
          if (drag.to !== drag.from) onMove(drag.from, drag.to);
          setDrag(null);
        },

        onPointerCancel: () => {
          cancelPress();
          if (drag && !drag.keyboard) setDrag(null);
        },

        onLostPointerCapture: () => {
          cancelPress();
        },
      };
    },
    [beginPointerDrag, drag, enabled, onMove, targetIndex],
  );

  // ───────────────────────────────────────────── автопрокрутка

  // Зависимость — сам факт переноса, а не его состояние: иначе цикл
  // перезапускался бы на каждом кадре движения пальца
  const carrying = drag !== null && !drag.keyboard;
  useEffect(() => {
    if (!carrying) return;
    const step = () => {
      const y = pointerClientY.current;
      const height = window.innerHeight;
      if (y < EDGE_ZONE_PX) window.scrollBy(0, -EDGE_SPEED_PX);
      else if (y > height - EDGE_ZONE_PX) window.scrollBy(0, EDGE_SPEED_PX);
      frame.current = window.requestAnimationFrame(step);
    };
    frame.current = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame.current);
  }, [carrying]);

  // ───────────────────────────────────────────── клавиатура

  const keyProps = useCallback(
    (id: string, index: number) => {
      if (!enabled) return {};
      return {
        tabIndex: 0,
        role: "button" as const,
        "aria-label": `Reorder card ${index + 1} of ${ids.length}. Press space to pick it up.`,
        onKeyDown: (event: React.KeyboardEvent) => {
          const active = drag?.keyboard && drag.id === id ? drag : null;

          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            if (!active) {
              measure(id);
              setDrag({ id, from: index, to: index, dy: 0, keyboard: true });
              setAnnouncement(
                `Picked up card ${index + 1} of ${ids.length}. Use the arrow keys to move it, space to drop.`,
              );
              return;
            }
            if (active.to !== active.from) onMove(active.from, active.to);
            setDrag(null);
            setAnnouncement(`Dropped at position ${active.to + 1} of ${ids.length}.`);
            return;
          }

          if (!active) return;

          if (event.key === "Escape") {
            event.preventDefault();
            setDrag(null);
            setAnnouncement("Move cancelled.");
            return;
          }

          const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
          if (step === 0) return;
          event.preventDefault();
          const to = Math.min(ids.length - 1, Math.max(0, active.to + step));
          if (to === active.to) return;
          setDrag({ ...active, to });
          setAnnouncement(`Position ${to + 1} of ${ids.length}.`);
        },
      };
    },
    [drag, enabled, ids.length, measure, onMove],
  );

  // ───────────────────────────────────────────── вид

  const itemStyle = useCallback(
    (id: string, index: number): React.CSSProperties | undefined => {
      if (!drag) return undefined;

      if (id === drag.id) {
        const offset = drag.keyboard ? (drag.to - drag.from) * shift.current : drag.dy;
        return {
          transform: `translate3d(0, ${offset}px, 0)${flat ? "" : " scale(1.02)"}`,
          transition: drag.keyboard ? `transform ${SHIFT_MS}ms ${SHIFT_EASE}` : undefined,
          position: "relative",
          zIndex: 30,
          touchAction: "none",
        };
      }

      // в сетке и при «уменьшить движение» соседи стоят на месте:
      // сдвиг по вертикали в двумерной раскладке врёт о том, куда встанет карточка
      if (flat) return undefined;

      const { from, to } = drag;
      let offset = 0;
      if (from < to && index > from && index <= to) offset = -shift.current;
      if (from > to && index >= to && index < from) offset = shift.current;
      return {
        transform: `translate3d(0, ${offset}px, 0)`,
        transition: `transform ${SHIFT_MS}ms ${SHIFT_EASE}`,
      };
    },
    [drag, flat],
  );

  /** Где встанет карточка. Показывается там, где соседи не расступаются. */
  const insertionAt = flat && drag ? drag.to : null;

  return {
    register,
    grabProps,
    keyProps,
    itemStyle,
    insertionAt,
    announcement,
    draggingId: drag?.id ?? null,
    active: drag !== null,
  };
}

function gapOf(el: HTMLElement | undefined) {
  if (!el?.parentElement) return 16;
  const gap = window.getComputedStyle(el.parentElement).rowGap;
  const parsed = Number.parseFloat(gap);
  return Number.isFinite(parsed) ? parsed : 16;
}

/**
 * Системная настройка «уменьшить движение».
 *
 * Через `useSyncExternalStore`, а не через эффект с `setState`: настройка живёт
 * вне React, её меняют на ходу, и подписка на внешний источник — ровно то, для
 * чего этот хук и существует. На сервере ответ «не уменьшать» — там движения
 * всё равно нет.
 */
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
let motionList: MediaQueryList | null = null;

function motionMedia() {
  if (!motionList) motionList = window.matchMedia(MOTION_QUERY);
  return motionList;
}

function subscribeMotion(onChange: () => void) {
  const query = motionMedia();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useMotionReduced() {
  return useSyncExternalStore(
    subscribeMotion,
    () => motionMedia().matches,
    () => false,
  );
}
