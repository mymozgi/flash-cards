import { notFound } from "next/navigation";
import Link from "next/link";
import { getKnowledgeTree } from "@/lib/knowledge";
import { getDeckSummaries } from "@/lib/data";
import { LinkButton } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { CategorySets } from "../category-sets";
import { NewSetButton } from "../new-set-button";

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [tree, summaries] = await Promise.all([
    getKnowledgeTree({ includeArchived: true }),
    getDeckSummaries(),
  ]);
  const node = tree.flat.find((n) => n.id === id);
  if (!node) notFound();

  /*
    Внутри категории лежат НАБОРЫ, и рисовать их надо плиткой набора, а не
    плиткой категории. Прежде здесь стояла вторая CategoryCard: набор
    показывался папкой, у которой внутри ноль папок, — то есть содержимое
    выдавалось за контейнер.
  */
  const sets = summaries.filter((deck) => deck.ancestors.includes(id));

  const tint = node.color || "var(--accent)";
  const trail = node.path.split(" / ").slice(0, -1);

  return (
    <>
      <Link href="/knowledge" className="text-sm text-faint hover:text-ink">
        ← Knowledge
      </Link>

      <header className={`${panelClass} mt-3 p-5 sm:p-6`}>
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-xl text-3xl"
            style={{ background: `color-mix(in srgb, ${tint} 14%, var(--surface))` }}
          >
            {node.icon || node.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            {trail.length > 0 && <p className="label-micro truncate">{trail.join(" / ")}</p>}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{node.name}</h1>
            {node.description && <p className="mt-2 max-w-prose text-muted">{node.description}</p>}
          </div>
        </div>

        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
          <span className="label-micro">
            <span className="tabular-nums">{node.cards}</span>{" "}
            {node.cards === 1 ? "card" : "cards"} in this branch
          </span>
          <span className="label-micro">
            <span className="tabular-nums">{sets.length}</span>{" "}
            {sets.length === 1 ? "set" : "sets"}
          </span>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {/*
            Действия категории — над категорией. «Edit cards» вело в
            конструктор набора с идентификатором КАТЕГОРИИ и тем самым
            обещало, что у категории есть свои карточки. Их у неё нет и быть
            не может: карточка живёт в наборе, это проверяет триггер в базе.

            Практиковать при этом можно всю ветку целиком — очередь собирает
            карточки всех наборов внутри, и это единственное учебное
            действие, которое у категории осмысленно.
          */}
          <LinkButton href={`/review?free=1&topic=${node.id}`} tone="soft">
            Practice this category
          </LinkButton>
          {/*
            Отдельной кнопки «Manage sets» здесь нет. Наборами управляют в
            самой секции наборов ниже: там они и лежат, там же выбор,
            меню и удаление. Кнопка вела бы на список тех же наборов —
            отдельный режим ради действий, которые доступны на месте.
          */}
          <LinkButton href={`/library?topic=${node.id}`}>Browse in library</LinkButton>
        </div>
      </header>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {sets.length > 0 ? `Sets · ${sets.length}` : "No sets yet"}
          </h2>
          {/* Создание набора стоит там, где на наборы смотрят. Прежде оно
              жило только в меню на экране категорий: чтобы завести набор в
              этой категории, надо было с неё уйти. */}
          <NewSetButton categoryId={node.id} categoryPath={node.path} />
        </div>

        {/* Пустое состояние живёт внутри: после удаления последнего набора
            секция должна сама стать пустой, а не ждать другой ветки. */}
        <CategorySets sets={sets} categoryId={node.id} categoryPath={node.path} />
      </section>
    </>
  );
}
