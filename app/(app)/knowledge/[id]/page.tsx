import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { resolveBack } from "@/lib/back-server";
import { getKnowledgeTree } from "@/lib/knowledge";
import { getDeckSummaries } from "@/lib/data";
import { withOrigin } from "@/lib/back";
import { LinkButton } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { CategorySets } from "../category-sets";

export default async function CategoryPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const [tree, summaries, back] = await Promise.all([
    getKnowledgeTree({ includeArchived: true }),
    getDeckSummaries(),
    resolveBack(query.from, { href: "/knowledge", label: "Knowledge" }),
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
      <BackLink href={back.href} label={back.label} />

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
          <LinkButton href={withOrigin(`/library?topic=${node.id}`, `/knowledge/${node.id}`)}>
            Browse in library
          </LinkButton>
          {/* Импорт отсюда уже знает назначение: спрашивать категорию, стоя
              внутри неё, значит задавать вопрос с одним ответом. */}
          <LinkButton href={`/import?category=${node.id}`}>Import CSV</LinkButton>
        </div>
      </header>

      <section className="mt-6">
        {/* Заголовок секции, кнопка выбора и создание набора живут внутри:
            выбор — это состояние, и делить заголовок между сервером и
            клиентом ради одной кнопки незачем. */}
        <CategorySets sets={sets} categoryId={node.id} categoryPath={node.path} />
      </section>
    </>
  );
}
