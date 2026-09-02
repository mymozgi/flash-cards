"use client";

import { useEffect, useRef, useState } from "react";
import type { KnowledgeNode } from "@/lib/knowledge";
import { Button } from "@/components/ui/button";
import { inputClass, Label, selectClass } from "@/components/ui/field";

/**
 * Создание и правка категории — одна форма на оба случая.
 *
 * Разводить их в два компонента было бы ошибкой: поля те же, проверки те же, и
 * разойтись они успели бы к третьей правке. Отличается только заголовок и то,
 * что при создании форма пустая.
 */
export type CategoryDraft = {
  name: string;
  icon: string;
  color: string;
  description: string;
  parentId: string | null;
  /** Имя категории, которую надо создать вместе с темой. */
  newCategory: string;
};

const DEFAULT: CategoryDraft = {
  name: "",
  icon: "",
  color: "#2563eb",
  description: "",
  parentId: null,
  newCategory: "",
};

export function EditDialog({
  open,
  node,
  kind = "area",
  parentId = null,
  options,
  busy,
  onSave,
  onClose,
}: {
  open: boolean;
  /** Правим существующую или создаём новую. */
  node: KnowledgeNode | null;
  /** Что создаём: категорию или группу карточек. У правки не используется. */
  kind?: "area" | "deck";
  /** Родитель для новой категории. */
  parentId?: string | null;
  /** Куда можно положить: без самого узла и его потомков. */
  options: { id: string; path: string }[];
  busy: boolean;
  onSave: (draft: CategoryDraft) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<CategoryDraft>(DEFAULT);
  const [seed, setSeed] = useState<string | null>(null);

  // Черновик заполняется при открытии, а не в эффекте по каждому изменению:
  // иначе правка поля затиралась бы обратно исходным значением
  const key = open ? (node?.id ?? `new:${parentId ?? "root"}`) : null;
  if (key !== seed) {
    setSeed(key);
    setDraft(
      node
        ? {
            name: node.name,
            icon: node.icon,
            color: node.color || "#2563eb",
            description: node.description,
            parentId: node.parentId,
            newCategory: "",
          }
        : { ...DEFAULT, parentId },
    );
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
        className="flex flex-col gap-4 p-5"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {node
            ? `Edit “${node.name}”`
            : kind === "deck"
              ? "Create flashcard group"
              : "Create category"}
        </h2>
        {!node && (
          /* Разница названа словами, а не подразумевается: два действия
             выглядят одинаково, и без подписи их путают */
          <p className="text-sm text-muted">
            {kind === "deck"
              ? "A group holds the cards you actually study."
              : "A category holds groups and other categories, not cards."}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="w-20">
            <Label>Icon</Label>
            <input
              value={draft.icon}
              onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value.slice(0, 4) }))}
              placeholder="🧠"
              aria-label="Icon"
              className={`${inputClass} text-center text-xl`}
            />
          </label>
          <label className="min-w-48 flex-1">
            <Label>Name</Label>
            <input
              autoFocus
              required
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Cognitive Biases"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col">
            <Label>Colour</Label>
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              aria-label="Colour"
              className="h-12 w-16 rounded-lg border-control border-field-line bg-surface"
            />
          </label>
        </div>

        <label className="block">
          <Label>Description</Label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={2}
            placeholder="What belongs in here?"
            className={`${inputClass} resize-y`}
          />
        </label>

        {/*
          У темы категория обязательна, у категории её быть не может.
          Раньше здесь стоял один список с пунктом «None — top level», и он
          позволял создать тему нигде: карточки складывались в узел, который
          потом не находился ни под одной областью.

          Если категорий ещё нет, выбирать не из чего — тогда поле превращается
          в ввод имени, и категория создаётся вместе с темой. Отправлять
          человека на другой экран за категорией, чтобы вернуться и создать
          тему, — это два действия там, где достаточно одного.
        */}
        {kind === "deck" && !node && (
          <label className="block">
            <Label>Category</Label>
            {options.length > 0 ? (
              <select
                required
                value={draft.parentId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value || null }))}
                className={selectClass}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.path}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  required
                  value={draft.newCategory}
                  onChange={(e) => setDraft((d) => ({ ...d, newCategory: e.target.value }))}
                  placeholder="Medicine"
                  className={inputClass}
                />
                <span className="mt-1.5 block text-2xs text-faint">
                  No categories yet — this one is created together with the topic.
                </span>
              </>
            )}
          </label>
        )}

        {kind === "deck" && node && (
          <label className="block">
            <Label>Category</Label>
            <select
              value={draft.parentId ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value || null }))}
              className={selectClass}
            >
              <option value="">Not filed into a category</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.path}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" tone="primary" loading={busy}>
            {node ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
