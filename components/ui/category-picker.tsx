"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { inputClass } from "./field";

/**
 * Выбор категории.
 *
 * До него категорию здесь адресовали набранным путём — «Psychology / Cognitive
 * Biases». Формально это работало: недостающие уровни создавались на лету. Но
 * ровно из-за этого категория и переставала быть сущностью. Опечатка не
 * возвращала ошибку, а молча заводила вторую категорию с похожим именем;
 * переименованная категория переставала находиться по старому пути; а увидеть,
 * что вообще существует, было нельзя — надо было помнить.
 *
 * Выбор из готового списка убирает все три беды разом: адресом становится
 * идентификатор, а не текст. Создание никуда не делось — но теперь это
 * отдельное, названное действие, а не побочный эффект опечатки.
 */
export type PickableCategory = {
  id: string;
  /** Полный путь через « / » — по нему и ищут, и отличают тёзок в разных ветках. */
  path: string;
  color?: string;
  icon?: string;
};

export type PickerOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Разрешить исход «вне категорий». Не везде он осмыслен. */
  allowNone?: boolean;
  noneLabel?: string;
  /** Текущее значение, чтобы показать его отмеченным. */
  current?: string | null;
};

/** `undefined` — отменили; `null` — выбрали «вне категорий». */
export type PickResult = string | null | undefined;

type Pending = {
  options: PickerOptions;
  resolve: (value: PickResult) => void;
};

export function useCategoryPicker(
  categories: PickableCategory[],
  /** Создание новой категории прямо из выбора. Без него строка «Create» не показывается. */
  onCreate?: (path: string) => Promise<{ id?: string; error?: string }>,
) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (pending && !node.open) node.showModal();
    if (!pending && node.open) node.close();
  }, [pending]);

  const settle = (value: PickResult) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
    setQuery("");
    setError(null);
  };

  const ask = (options: PickerOptions) =>
    new Promise<PickResult>((resolve) => {
      setQuery("");
      setError(null);
      setPending({ options, resolve });
    });

  const text = query.trim();
  const matches = useMemo(() => {
    const q = text.toLowerCase();
    const list = q
      ? categories.filter((category) => category.path.toLowerCase().includes(q))
      : categories;
    return list.slice(0, 200);
  }, [categories, text]);

  /** Точное совпадение по пути — тогда создавать нечего, надо выбирать. */
  const exact = matches.some((category) => category.path.toLowerCase() === text.toLowerCase());

  const create = async () => {
    if (!onCreate || !text) return;
    setBusy(true);
    setError(null);
    const res = await onCreate(text);
    setBusy(false);
    if (res.error || !res.id) {
      setError(res.error ?? "Could not create the category");
      return;
    }
    settle(res.id);
  };

  const options = pending?.options;

  const dialog = (
    <dialog
      ref={ref}
      onClose={() => settle(undefined)}
      onClick={(event) => {
        if (event.target === ref.current) settle(undefined);
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      {options && (
        <div className="flex max-h-[80dvh] flex-col p-5">
          <h2 className="text-lg font-semibold tracking-tight">{options.title}</h2>
          {options.description && (
            <p className="mt-2 text-sm text-muted">{options.description}</p>
          )}

          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, or type a new name…"
            aria-label="Search categories"
            className={`${inputClass} mt-4`}
          />

          {error && (
            <p role="alert" className="mt-2 text-2xs font-medium text-rust">
              {error}
            </p>
          )}

          <ul className="mt-3 min-h-32 flex-1 overflow-y-auto rounded-lg border border-line">
            {options.allowNone && (
              <li className="border-b border-line">
                <button
                  type="button"
                  onClick={() => settle(null)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                >
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-line-strong" />
                  <span className="text-muted">{options.noneLabel ?? "No category"}</span>
                </button>
              </li>
            )}

            {matches.map((category) => (
              <li key={category.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => settle(category.id)}
                  aria-current={options.current === category.id ? "true" : undefined}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2 ${
                    options.current === category.id ? "bg-accent-soft text-accent" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-md text-2xs"
                    style={{
                      background: `color-mix(in srgb, ${category.color || "var(--accent)"} 18%, var(--surface))`,
                    }}
                  >
                    {category.icon || category.path.trim().charAt(0).toUpperCase()}
                  </span>
                  {/* Полный путь, а не одно имя: подкатегории-тёзки в разных
                      ветках — это норма, и различить их можно только путём */}
                  <span className="truncate">{category.path}</span>
                </button>
              </li>
            ))}

            {matches.length === 0 && !onCreate && (
              <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</li>
            )}
          </ul>

          {onCreate && text && !exact && (
            <Button tone="soft" onClick={create} loading={busy} className="mt-3 justify-start">
              {/* Создание — названное действие, а не побочный эффект опечатки */}
              Create “{text}”
              <span className="text-2xs opacity-70">use / to nest it</span>
            </Button>
          )}

          <div className="mt-4 flex justify-end">
            <Button onClick={() => settle(undefined)}>Cancel</Button>
          </div>
        </div>
      )}
    </dialog>
  );

  return { ask, dialog };
}
