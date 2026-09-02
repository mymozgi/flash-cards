"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, type ButtonTone } from "./button";
import { inputClass } from "./field";

/**
 * Диалог ввода строки вместо системного prompt.
 *
 * Причины те же, по которым в проекте уже нет системного confirm, плюс одна
 * своя. Системный prompt не стилизуется и игнорирует тему; он блокирует поток;
 * скринридер объявляет его заголовком вкладки, а не сутью вопроса. И главное:
 * браузер вправе его просто не показать — во встроенном просмотрщике, в
 * песочнице iframe и в приложениях со встроенным браузером вызов молча
 * возвращает null или падает. Отсюда и берётся ошибка на строке с `prompt`.
 *
 * Нативный <dialog> даёт ловушку фокуса, Escape и подложку бесплатно.
 *
 * API повторяет привычный prompt, поэтому вызов меняется одной строкой:
 *
 *   const { ask, dialog } = usePrompt();
 *   const name = await ask({ title: "Rename", initialValue: topic.name });
 *   if (name === null) return;
 *   return (<>{dialog} …</>);
 */
export type PromptOptions = {
  title: string;
  description?: string;
  /** Подпись поля. Без неё поле подписывает заголовок. */
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonTone;
  /** Пустая строка обычно бессмысленна, но не всегда — например «убрать тему». */
  allowEmpty?: boolean;
  /** Проверка до закрытия: вернуть текст отказа или null, если всё в порядке. */
  validate?: (value: string) => string | null;
};

type Pending = {
  options: PromptOptions;
  resolve: (value: string | null) => void;
};

export function usePrompt() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (pending && !node.open) {
      node.showModal();
      // Текст выделен целиком: переименование чаще заменяет имя, чем правит его
      field.current?.select();
    }
    if (!pending && node.open) node.close();
  }, [pending]);

  const settle = useCallback((result: string | null) => {
    setPending((current) => {
      current?.resolve(result);
      return null;
    });
    setError(null);
  }, []);

  const ask = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(options.initialValue ?? "");
        setError(null);
        setPending({ options, resolve });
      }),
    [],
  );

  const options = pending?.options;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!options) return;
    const text = value.trim();
    if (!text && !options.allowEmpty) {
      setError("Enter a value");
      return;
    }
    const failure = options.validate?.(text) ?? null;
    if (failure) {
      setError(failure);
      return;
    }
    settle(text);
  };

  const dialog = (
    <dialog
      ref={ref}
      // Escape, крестик или клик по подложке — всё это отмена
      onClose={() => settle(null)}
      onClick={(event) => {
        if (event.target === ref.current) settle(null);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      {options && (
        <form onSubmit={submit} className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">{options.title}</h2>
          {options.description && <p className="mt-2 text-sm text-muted">{options.description}</p>}

          <label className="mt-4 block">
            {options.label && (
              <span className="block pb-2 text-sm font-semibold text-ink">{options.label}</span>
            )}
            <input
              ref={field}
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={options.placeholder}
              aria-label={options.label ?? options.title}
              aria-invalid={error ? true : undefined}
              className={inputClass}
            />
          </label>

          {error && (
            <p role="alert" className="mt-1.5 text-2xs font-medium text-rust">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" onClick={() => settle(null)}>
              {options.cancelLabel ?? "Cancel"}
            </Button>
            <Button type="submit" tone={options.tone ?? "primary"}>
              {options.confirmLabel ?? "Save"}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );

  return { ask, dialog };
}
