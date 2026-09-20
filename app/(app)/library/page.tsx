import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { resolveBack } from "@/lib/back-server";
import { createClient, currentUser } from "@/lib/supabase/server";
import { getTopicTree } from "@/lib/data";
import { publicUrl } from "@/lib/storage";
import { CardList, type LibraryCard } from "./card-list";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

const PAGE_SIZE = 100;

export default async function LibraryPage(props: {
  searchParams: Promise<{ topic?: string; q?: string; from?: string }>;
}) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const [topics, user, back] = await Promise.all([
    getTopicTree(),
    currentUser(),
    /*
      Библиотеку открывают и из категории, и из набора, и из меню. Ссылка
      «назад» обязана вести туда, откуда пришли: без этого выход из
      библиотеки всегда высаживал в один и тот же список.
    */
    resolveBack(params.from, { href: "/decks", label: "All sets" }),
  ]);

  // фильтр по теме включает всех её потомков
  let topicIds: string[] | null = null;
  if (params.topic) {
    const selected = topics.find((t) => t.id === params.topic);
    if (selected) {
      topicIds = topics
        .filter((t) => t.id === selected.id || t.path.startsWith(`${selected.path} / `))
        .map((t) => t.id);
    }
  }

  /*
    Разложение фильтра на два уровня. Активная категория — корень выбранной
    ветки, а не сам выбранный узел: выбрав тему, человек остаётся внутри своей
    категории, и та обязана остаться подсвеченной.
  */
  const roots = topics.filter((t) => t.parent_id === null);
  const selectedNode = params.topic ? topics.find((t) => t.id === params.topic) : undefined;
  const activeRoot = selectedNode
    ? roots.find((r) => r.id === selectedNode.id || selectedNode.path.startsWith(`${r.path} / `))
    : undefined;
  const childTopics = activeRoot ? topics.filter((t) => t.parent_id === activeRoot.id) : [];

  let query = supabase
    .from("cards")
    .select("id,front_md,back_md,topic_id,suspended, scheduling(state), media(thumb_path,position)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (topicIds) query = query.in("topic_id", topicIds);
  // пустой список нельзя отдавать в .in по uuid-колонке — Postgres ругнётся на ''
  if (params.q?.trim()) query = query.textSearch("search", params.q.trim(), { config: "russian" });

  const { data, error } = await query;

  const pathById = new Map(topics.map((t) => [t.id, t.path]));
  const cards: LibraryCard[] = (
    (data ?? []) as unknown as {
      id: string;
      front_md: string;
      back_md: string;
      topic_id: string | null;
      suspended: boolean;
      scheduling: { state: string } | { state: string }[] | null;
      media: { thumb_path: string; position: number }[];
    }[]
  ).map((row) => ({
    id: row.id,
    front: row.front_md,
    back: row.back_md,
    topicId: row.topic_id,
    topicPath: row.topic_id ? (pathById.get(row.topic_id) ?? null) : null,
    suspended: row.suspended,
    state: (Array.isArray(row.scheduling) ? row.scheduling[0]?.state : row.scheduling?.state) ?? "new",
    thumbUrl:
      (row.media ?? []).length > 0
        ? publicUrl([...row.media].sort((a, b) => a.position - b.position)[0].thumb_path)
        : null,
  }));

  return (
    <>
      <BackLink href={back.href} label={back.label} />
      <header className="mt-3 border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
        <form className="mt-4 flex gap-2">
          {params.topic && <input type="hidden" name="topic" value={params.topic} />}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search card text"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <Button type="submit">Search</Button>
        </form>
      </header>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        <Filter href="/library" active={!params.topic}>
          All
        </Filter>
        {/*
          Фильтр в два ряда, а не одним списком путей. Прежде здесь вперемешку
          лежали и категории, и темы, и различить их можно было только по
          наличию « / » в подписи. Порядок теперь тот же, что в голове: сначала
          область, потом раздел внутри неё.
        */}
        {roots.map((root) => (
          <Filter
            key={root.id}
            href={`/library?topic=${root.id}`}
            active={activeRoot?.id === root.id}
          >
            {root.icon && <span aria-hidden className="mr-1.5">{root.icon}</span>}
            {root.name}
          </Filter>
        ))}
      </div>

      {activeRoot && childTopics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2 text-xs">
          <Filter href={`/library?topic=${activeRoot.id}`} active={params.topic === activeRoot.id}>
            All of {activeRoot.name}
          </Filter>
          {childTopics.map((topic) => (
            <Filter
              key={topic.id}
              href={`/library?topic=${topic.id}`}
              active={params.topic === topic.id}
            >
              {topic.name}
            </Filter>
          ))}
        </div>
      )}


      <div className="mt-5">
        {error ? (
          <p role="alert" className="rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
            Could not load cards: {error.message}
          </p>
        ) : cards.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Nothing found.{" "}
            <Link href="/decks?new=1" className="text-accent underline underline-offset-4">
              Create a set
            </Link>
          </p>
        ) : (
          <CardList
          cards={cards}
          categories={topics.map((topic) => ({
            id: topic.id,
            path: topic.path,
            color: topic.color ?? undefined,
          }))}
          readOnly={!user}
        />
        )}
      </div>
    </>
  );
}

function Filter({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded px-2.5 py-1 ${
        active ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
