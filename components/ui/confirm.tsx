"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, type ButtonTone } from "./button";

/**
 * Диалог подтверждения вместо системного confirm.
 *
 * Системный не стилизуется, ломает вид платформы, в некоторых контекстах
 * блокируется браузером и объявляется скринридером как окно «Code» — то есть
 * заголовком вкладки, а не сутью вопроса.
 *
 * Используется нативный <dialog>: он бесплатно даёт ловушку фокуса, закрытие
 * по Escape и подложку. Писать это руками — значит писать это неправильно.
 *
 * API повторяет привычный confirm, поэтому вызов меняется одной строкой:
 *
 *   const { ask, dialog } = useConfirm();
 *   if (!(await ask({ title: "Delete this card?" }))) return;
 *   return (<>{dialog} …</>);
 */
export type ConfirmAction<T extends string = string> = {
  value: T;
  label: string;
  tone?: ButtonTone;
};

export type ConfirmOptions<T extends string = string> = {
  title: string;
  description?: string;
  /** Подпись основной кнопки, когда выбор бинарный. */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonTone;
  /** Больше двух исходов: каждый получает свою кнопку и понятную подпись. */
  actions?: ConfirmAction<T>[];
};

type Pending<T extends string> = {
  options: ConfirmOptions<T>;
  resolve: (value: T | "confirm" | null) => void;
};

export function useConfirm<T extends string = string>() {
  const [pending, setPending] = useState<Pending<T> | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (pending && !node.open) node.showModal();
    if (!pending && node.open) node.close();
  }, [pending]);

  const settle = useCallback((value: T | "confirm" | null) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const ask = useCallback(
    (options: ConfirmOptions<T>) =>
      new Promise<T | "confirm" | null>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const options = pending?.options;
  const actions: ConfirmAction<string>[] = options?.actions ?? [
    { value: "confirm", label: options?.confirmLabel ?? "Delete", tone: options?.tone ?? "danger" },
  ];

  const dialog = (
    <dialog
      ref={ref}
      // Закрытие крестиком, Escape или кликом по подложке — всё это отмена
      onClose={() => settle(null)}
      onClick={(event) => {
        if (event.target === ref.current) settle(null);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      {options && (
        <div className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">{options.title}</h2>
          {options.description && (
            <p className="mt-2 text-sm text-muted">{options.description}</p>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button onClick={() => settle(null)}>{options.cancelLabel ?? "Cancel"}</Button>
            {actions.map((action) => (
              <Button
                key={action.value}
                tone={action.tone ?? "danger"}
                onClick={() => settle(action.value as T)}
                autoFocus={actions.length === 1}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );

  return { ask, dialog };
}
