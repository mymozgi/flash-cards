"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { KnowledgeNode } from "@/lib/knowledge";
import { Button } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { inputClass, Label } from "@/components/ui/field";
import { usePrompt } from "@/components/ui/prompt";
import { PlusIcon } from "@/components/icons";
import { createCategory, createStarterCategories, updateCategory } from "./actions";
import { STARTERS } from "./starters";
import { CategoryCard } from "./category-card";

export function KnowledgeIndex({
  roots,
  legacy,
  countsReady,
}: {
  roots: KnowledgeNode[];
  /** Миграция 0015 не применена: иконки и архив база ещё не умеет. */
  legacy: boolean;
  /** Миграция 0017 не применена: объём ветки неизвестен, нули не показываем. */
  countsReady: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", icon: "", color: "#2563eb" });
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const { ask, dialog } = usePrompt();

  const refresh = (res: { ok: boolean; error?: string }) => {
    if (!res.ok) {
      setError(res.error ?? "Something went wrong");
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  };

  const create = () => {
    startTransition(async () => {
      const res = await createCategory(draft);
      if (!refresh(res)) return;
      setDraft({ name: "", icon: "", color: "#2563eb" });
      setCreating(false);
    });
  };

  const rename = async (node: KnowledgeNode) => {
    const name = await ask({
      title: `Rename “${node.name}”`,
      label: "Name",
      initialValue: node.name,
      confirmLabel: "Rename",
    });
    if (name === null || name === node.name) return;
    startTransition(async () => {
      refresh(await updateCategory(node.id, { name }));
    });
  };

  const archive = (node: KnowledgeNode) => {
    startTransition(async () => {
      refresh(await updateCategory(node.id, { archived: true }));
    });
  };

  const addStarters = () => {
    const chosen = STARTERS.filter((s) => picks.has(s.name));
    startTransition(async () => {
      if (refresh(await createStarterCategories(chosen))) setPicks(new Set());
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      {dialog}

      {(legacy || !countsReady) && (
        <p role="alert" className={`${panelClass} border-amber bg-amber-soft p-4 text-sm`}>
          {legacy && (
            <>
              Icons and archiving need <code>supabase/migrations/0015_knowledge_nodes.sql</code>.{" "}
            </>
          )}
          {!countsReady && (
            <>
              Branch counts need <code>supabase/migrations/0017_topic_rollup.sql</code> — until it
              is applied they are hidden rather than shown as zero.{" "}
            </>
          )}
          Everything else on this page works without them.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {roots.length > 0 ? `${roots.length} ${roots.length === 1 ? "category" : "categories"}` : "No categories yet"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={() => setCreating((c) => !c)}>
            <PlusIcon />
            Add category
          </Button>
        </div>
      </div>

      {creating && (
        <div className={`${panelClass} flex flex-col gap-3 p-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="w-20">
              <Label>Icon</Label>
              <input
                value={draft.icon}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value.slice(0, 4) }))}
                placeholder="🧠"
                aria-label="Category icon"
                className={`${inputClass} text-center text-xl`}
              />
            </label>
            <label className="min-w-48 flex-1">
              <Label>Name</Label>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Psychology"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col">
              <Label>Colour</Label>
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                aria-label="Category colour"
                className="h-12 w-16 rounded-lg border-control border-field-line bg-surface"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button tone="primary" onClick={create} loading={busy}>
              Create
            </Button>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {roots.length === 0 && !creating ? (
        /*
          Пустой экран предлагает заготовки, но не создаёт их молча. Отмеченные
          становятся обычными категориями: их можно переименовать, перекрасить
          и удалить, как любые другие. Заготовка, которую нельзя тронуть, — это
          уже чужая структура в моём пространстве.
        */
        <div className={`${panelClass} p-5 sm:p-6`}>
          <h3 className="font-semibold">Start from something, or from nothing</h3>
          <p className="mt-1.5 max-w-prose text-sm text-muted">
            Pick any of these to get going. They are ordinary categories from the moment they are
            created — rename them, recolour them, throw them away.
          </p>

          <ul className="mt-4 flex flex-wrap gap-2">
            {STARTERS.map((starter) => {
              const on = picks.has(starter.name);
              return (
                <li key={starter.name}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicks((prev) => {
                        const next = new Set(prev);
                        if (next.has(starter.name)) next.delete(starter.name);
                        else next.add(starter.name);
                        return next;
                      })
                    }
                    className={`flex min-h-11 items-center gap-2 rounded-full border-control px-4 text-sm font-semibold ${
                      on ? "border-accent bg-accent-soft text-accent" : "border-field-line text-muted"
                    }`}
                  >
                    <span aria-hidden>{starter.icon}</span>
                    {starter.name}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button tone="primary" onClick={addStarters} loading={busy} disabled={picks.size === 0}>
              Create {picks.size > 0 ? picks.size : ""} {picks.size === 1 ? "category" : "categories"}
            </Button>
            <Button onClick={() => setCreating(true)}>Name my own instead</Button>
          </div>
        </div>
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
          {roots.map((node) => (
            <li key={node.id}>
              <CategoryCard
                node={node}
                counts={countsReady}
                canArchive={!legacy}
                onRename={() => void rename(node)}
                onArchive={() => archive(node)}
              />
            </li>
          ))}
        </ul>
      )}

      {roots.length > 0 && (
        <p className="text-sm text-muted">
          Nesting, drag and drop and the map arrive next.{" "}
          <Link href="/decks" className="text-accent underline underline-offset-4">
            Study sets
          </Link>{" "}
          still work exactly as before.
        </p>
      )}
    </div>
  );
}
