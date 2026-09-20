"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { KnowledgeNode } from "@/lib/knowledge";
import { Button, buttonClass } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { inputClass } from "@/components/ui/field";
import { usePrompt } from "@/components/ui/prompt";
import { useConfirm } from "@/components/ui/confirm";
import { GridIcon, PlusIcon, SearchIcon, TableIcon } from "@/components/icons";
import {
  createCategory,
  createStarterCategories,
  removeCategory,
  updateCategory,
} from "./actions";
import { STARTERS } from "./starters";
import { CategoryCard } from "./category-card";
import { NodeMenu, type MenuAction } from "./node-menu";
import { EditDialog, type CategoryDraft } from "./edit-dialog";

type View = "cards" | "list";

/*
  Видов два, а не три. «Tree» показывал то же самое дерево, что и плитки, но
  строчками — и мешал: два способа смотреть на одно и то же заставляют
  выбирать между ними вместо того, чтобы работать. Перенос узлов переехал
  туда, где он и нужен, — в саму структуру категорий.
*/
const VIEWS: { key: View; label: string; Icon: typeof GridIcon }[] = [
  { key: "cards", label: "Cards", Icon: GridIcon },
  { key: "list", label: "List", Icon: TableIcon },
];

export function KnowledgeIndex({
  roots,
  flat,
  legacy,
  countsReady,
}: {
  roots: KnowledgeNode[];
  flat: KnowledgeNode[];
  /** Миграция 0015 не применена: иконки и архив база ещё не умеет. */
  legacy: boolean;
  /** Миграция 0017 не применена: объём ветки неизвестен, нули не показываем. */
  countsReady: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("cards");
  const [query, setQuery] = useState("");
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ node: KnowledgeNode; at: { x: number; y: number } } | null>(null);
  const [editing, setEditing] = useState<{
    node: KnowledgeNode | null;
    parentId: string | null;
    /** Что именно создаём. У правки берётся из самого узла. */
    kind?: "area" | "deck";
  } | null>(null);
  const { ask: askText, dialog: promptDialog } = usePrompt();
  const { ask: askChoice, dialog: confirmDialog } = useConfirm<"cascade" | "reparent">();

  const settle = (res: { ok: boolean; error?: string }) => {
    if (!res.ok) {
      setError(res.error ?? "Something went wrong");
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  };

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return flat.filter((node) => node.path.toLowerCase().includes(q));
  }, [flat, query]);

  /** Куда можно положить узел: всё дерево без него самого и его потомков. */
  const parentOptions = useMemo(() => {
    const banned = new Set<string>();
    const target = editing?.node;
    if (target) {
      const walk = (node: KnowledgeNode) => {
        banned.add(node.id);
        node.children.forEach(walk);
      };
      walk(target);
    }
    // В список попадают только категории: тему внутрь темы база не пустит,
    // и предлагать такой выбор значит предлагать заведомый отказ
    return flat
      .filter((n) => !banned.has(n.id) && n.kind !== "deck" && n.parentId === null)
      .map((n) => ({ id: n.id, path: n.path }));
  }, [flat, editing]);

  const rename = async (node: KnowledgeNode) => {
    const name = await askText({
      title: `Rename “${node.name}”`,
      label: "Name",
      initialValue: node.name,
      confirmLabel: "Rename",
    });
    if (name === null || name === node.name) return;
    startTransition(async () => void settle(await updateCategory(node.id, { name })));
  };

  const drop = async (node: KnowledgeNode) => {
    // Пустая категория не порождает вопроса «куда деть содержимое»: содержимого
    // нет, и выбор из двух одинаковых исходов — это работа, навязанная зря
    const empty = countsReady && node.cards === 0 && node.descendants === 0;
    const where = node.parentId ? "up to the parent category" : "out of every category";

    const choice = await askChoice({
      title: `Delete “${node.name}”?`,
      description: empty
        ? "It is empty — nothing else goes with it."
        : `It holds ${node.cards} ${node.cards === 1 ? "card" : "cards"}` +
          (node.descendants > 0
            ? ` and ${node.descendants} ${node.descendants === 1 ? "set" : "sets"}`
            : "") +
          `. Move them ${where}, or delete the branch. Cards are never deleted here — deleting a branch only takes them out of it.`,
      actions: empty
        ? [{ value: "cascade", label: "Delete", tone: "danger" }]
        : [
            { value: "reparent", label: "Move contents out", tone: "secondary" },
            { value: "cascade", label: "Delete the branch", tone: "danger" },
          ],
    });
    if (choice !== "cascade" && choice !== "reparent") return;
    startTransition(async () => void settle(await removeCategory(node.id, choice)));
  };

  const onMenuPick = (node: KnowledgeNode, action: MenuAction) => {
    setMenu(null);
    if (action === "open") router.push(`/knowledge/${node.id}`);
    if (action === "cards") router.push(`/library?topic=${node.id}`);
    if (action === "study") router.push(`/review?free=1&topic=${node.id}`);
    if (action === "rename") void rename(node);
    if (action === "edit") setEditing({ node, parentId: node.parentId });
    if (action === "group") setEditing({ node: null, parentId: node.id, kind: "deck" });
    if (action === "delete") void drop(node);
    if (action === "archive") {
      startTransition(async () => void settle(await updateCategory(node.id, { archived: true })));
    }
    if (action === "unarchive") {
      startTransition(async () => void settle(await updateCategory(node.id, { archived: false })));
    }
  };

  const save = (draft: CategoryDraft) => {
    const target = editing?.node;
    const kind = editing?.kind ?? "area";

    startTransition(async () => {
      if (target) {
        if (settle(await updateCategory(target.id, {
          name: draft.name,
          icon: draft.icon,
          color: draft.color,
          description: draft.description,
          parentId: draft.parentId,
        }))) {
          setEditing(null);
        }
        return;
      }

      /*
        Тема без категории не создаётся. Если категорий ещё нет, она заводится
        здесь же по введённому имени — отправлять человека на другой экран за
        категорией, чтобы вернуться и создать тему, значит требовать два
        действия там, где достаточно одного.
      */
      let parentId = draft.parentId;
      if (kind === "deck" && !parentId) {
        const name = draft.newCategory.trim();
        if (!name) {
          setError("Pick a category, or name a new one");
          return;
        }
        const created = await createCategory({ name, kind: "area" });
        if (!created.ok || !created.id) {
          setError(created.error ?? "Could not create the category");
          return;
        }
        parentId = created.id;
      }

      const res = await createCategory({
        name: draft.name,
        icon: draft.icon,
        color: draft.color,
        parentId,
        kind,
      });
      if (settle(res)) setEditing(null);
    });
  };

  const addStarters = () => {
    const chosen = STARTERS.filter((s) => picks.has(s.name));
    startTransition(async () => {
      if (settle(await createStarterCategories(chosen))) setPicks(new Set());
    });
  };

  const empty = roots.length === 0;

  return (
    <div className="mt-6 flex flex-col gap-4">
      {promptDialog}
      {confirmDialog}

      <EditDialog
        open={editing !== null}
        node={editing?.node ?? null}
        kind={editing?.kind ?? "area"}
        parentId={editing?.parentId ?? null}
        options={parentOptions}
        busy={busy}
        onSave={save}
        onClose={() => setEditing(null)}
      />

      {menu && (
        <NodeMenu
          node={menu.node}
          at={menu.at}
          onPick={(action) => onMenuPick(menu.node, action)}
          onClose={() => setMenu(null)}
        />
      )}

      {(legacy || !countsReady) && (
        <p role="alert" className={`${panelClass} border-amber bg-amber-soft p-4 text-sm`}>
          {legacy && (
            <>
              Icons, archiving and node kinds need{" "}
              <code>supabase/migrations/0015_knowledge_nodes.sql</code>.{" "}
            </>
          )}
          {!countsReady && (
            <>
              Branch counts need <code>supabase/migrations/0017_topic_rollup.sql</code> — until it is
              applied they are hidden rather than shown as zero.{" "}
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

      {!empty && (
        <div className={`${panelClass} flex flex-wrap items-center gap-2 p-2`}>
          <div className="relative w-full min-w-0 sm:flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              aria-label="Search categories"
              className={`${inputClass} pl-11`}
            />
          </div>

          <div className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1">
            {VIEWS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                aria-pressed={view === item.key}
                className={`flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold ${
                  view === item.key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                <item.Icon className="size-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          <Link href="/knowledge/map" className={`${buttonClass("secondary", "md")} min-h-10`}>
            Map
          </Link>
          <Button
            tone="primary"
            onClick={() => setEditing({ node: null, parentId: null, kind: "area" })}
          >
            <PlusIcon />
            Add category
          </Button>
        </div>
      )}

      {empty ? (
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
              Create {picks.size > 0 ? picks.size : ""}{" "}
              {picks.size === 1 ? "category" : "categories"}
            </Button>
            <Button onClick={() => setEditing({ node: null, parentId: null, kind: "area" })}>
              Name my own instead
            </Button>
          </div>
        </div>
      ) : found ? (
        <SearchResults nodes={found} onOpen={(id) => router.push(`/knowledge/${id}`)} />
      ) : view === "list" ? (
        <SearchResults nodes={flat} onOpen={(id) => router.push(`/knowledge/${id}`)} />
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
          {roots.map((node) => (
            <li key={node.id}>
              <CategoryCard
                node={node}
                counts={countsReady}
                onOpenMenu={(at) => setMenu({ node, at })}
                onEdit={() => setEditing({ node, parentId: node.parentId })}
              />
            </li>
          ))}
        </ul>
      )}

      {!empty && (
        <p className="text-sm text-muted">
          <Link href="/knowledge/map" className="text-accent underline underline-offset-4">
            Open the map
          </Link>{" "}
          to see the whole structure and attach cards to a category.{" "}
          <Link href="/decks" className="text-accent underline underline-offset-4">
            Study sets
          </Link>{" "}
          and review work exactly as before.
        </p>
      )}
    </div>
  );
}

/** Плоский список: и результат поиска, и вид List — это одно и то же зрелище. */
function SearchResults({
  nodes,
  onOpen,
}: {
  nodes: KnowledgeNode[];
  onOpen: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface py-16 text-center text-sm text-muted">
        Nothing matches.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onOpen(node.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-md text-sm"
              style={{
                background: `color-mix(in srgb, ${node.color || "var(--accent)"} 16%, var(--surface))`,
              }}
            >
              {node.icon || node.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{node.name}</span>
              <span className="label-micro block truncate">{node.path}</span>
            </span>
            <span className="label-micro shrink-0 tabular-nums">{node.cards}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
