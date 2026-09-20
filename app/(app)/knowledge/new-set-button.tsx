"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";
import { EditDialog, type CategoryDraft } from "./edit-dialog";
import { createCategory } from "./actions";

/**
 * Создание набора прямо внутри категории.
 *
 * Набор заводят раньше, чем наполняют: структуру удобнее выстроить сразу, а
 * карточки разложить потом. До этой кнопки пустой набор можно было создать
 * только из меню на экране категорий — то есть уйдя с той самой категории, в
 * которую его кладут, и вернувшись обратно.
 *
 * Диалог тот же, что и везде. Своя форма здесь означала бы второе место, где
 * задают имя, цвет и категорию, и эти два места разошлись бы.
 */
export function NewSetButton({
  categoryId,
  categoryPath,
}: {
  categoryId: string;
  /** Путь категории — он же подпись в поле выбора внутри диалога. */
  categoryPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const save = (draft: CategoryDraft) => {
    startTransition(async () => {
      const res = await createCategory({
        name: draft.name,
        // Категория подставлена заранее: набор создают, стоя внутри неё,
        // и спрашивать «куда» было бы вопросом с одним ответом.
        parentId: draft.parentId ?? categoryId,
        icon: draft.icon,
        color: draft.color,
        kind: "deck",
      });

      if (!res.ok) {
        setError(res.error ?? "Could not create the set");
        return;
      }
      setError(null);
      setOpen(false);
      // Набор должен появиться сразу, а не после обновления страницы руками
      router.refresh();
    });
  };

  return (
    <>
      <Button size="sm" tone="primary" onClick={() => setOpen(true)}>
        <PlusIcon />
        New set
      </Button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rust">
          {error}
        </p>
      )}

      <EditDialog
        open={open}
        node={null}
        kind="deck"
        parentId={categoryId}
        options={[{ id: categoryId, path: categoryPath }]}
        busy={busy}
        onSave={save}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
