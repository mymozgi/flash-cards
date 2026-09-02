import Link from "next/link";
import { createClient, currentUser } from "@/lib/supabase/server";
import { getTags, getTopicTree } from "@/lib/data";
import { publicUrl } from "@/lib/storage";
import { CardList, type LibraryCard } from "./card-list";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

const PAGE_SIZE = 100;

export default async function LibraryPage(props: {
  searchParams: Promise<{ topic?: string; tag?: string; q?: string }>;
}) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const [topics, tags, user] = await Promise.all([getTopicTree(), getTags(), currentUser()]);

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

  let cardIds: string[] | null = null;
  if (params.tag) {
    const { data } = await supabase.from("card_tags").select("card_id").eq("tag_id", params.tag);
    cardIds = (data ?? []).map((r: { card_id: string }) => r.card_id);
  }

  let query = supabase
    .from("cards")
    .select("id,front_md,back_md,topic_id,suspended, card_tags(tags(name)), scheduling(state), media(thumb_path,position)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (topicIds) query = query.in("topic_id", topicIds);
  // пустой список нельзя отдавать в .in по uuid-колонке — Postgres ругнётся на ''
  if (cardIds && cardIds.length === 0) cardIds = ["00000000-0000-0000-0000-000000000000"];
  if (cardIds) query = query.in("id", cardIds);
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
      card_tags: { tags: { name: string } }[];
      scheduling: { state: string } | { state: string }[] | null;
      media: { thumb_path: string; position: number }[];
    }[]
  ).map((row) => ({
    id: row.id,
    front: row.front_md,
    back: row.back_md,
    topicId: row.topic_id,
    topicPath: row.topic_id ? (pathById.get(row.topic_id) ?? null) : null,
    tags: (row.card_tags ?? []).map((t) => t.tags.name),
    suspended: row.suspended,
    state: (Array.isArray(row.scheduling) ? row.scheduling[0]?.state : row.scheduling?.state) ?? "new",
    thumbUrl:
      (row.media ?? []).length > 0
        ? publicUrl([...row.media].sort((a, b) => a.position - b.position)[0].thumb_path)
        : null,
  }));

  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
        <form className="mt-4 flex gap-2">
          {params.topic && <input type="hidden" name="topic" value={params.topic} />}
          {params.tag && <input type="hidden" name="tag" value={params.tag} />}
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
        <Filter href="/library" active={!params.topic && !params.tag}>
          All
        </Filter>
        {topics.map((topic) => (
          <Filter key={topic.id} href={`/library?topic=${topic.id}`} active={params.topic === topic.id}>
            {topic.path}
          </Filter>
        ))}
        {tags.map((tag) => (
          <Filter key={tag.id} href={`/library?tag=${tag.id}`} active={params.tag === tag.id}>
            #{tag.name}
          </Filter>
        ))}
      </div>

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
          <CardList cards={cards} readOnly={!user} />
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
