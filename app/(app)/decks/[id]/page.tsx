import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeckWorkspace } from "./deck-workspace";
import type { DeckCardInput } from "./actions";

const OPTION_SLOTS = 5;

type CardRow = {
  id: string;
  front_md: string;
  back_md: string;
  example_md: string | null;
  link_url: string | null;
  mcq: boolean;
  distractors: string[] | null;
  card_tags: { tags: { name: string } }[];
};

export default async function DeckPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id,name,description,color,parent_id")
    .eq("id", id)
    .maybeSingle();

  if (!topic) notFound();

  const [{ data: parent }, { data: rows }, { data: tagRows }] = await Promise.all([
    topic.parent_id
      ? supabase.from("topics").select("name").eq("id", topic.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cards")
      .select(
        "id,front_md,back_md,example_md,link_url,mcq,distractors, card_tags(tags(name))",
      )
      .eq("topic_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("tags").select("name").order("name"),
  ]);

  const cards: DeckCardInput[] = ((rows ?? []) as unknown as CardRow[]).map((row) => {
    // верный ответ всегда занимает первый слот: набор слотов — это просто
    // представление, в базе лежат оборот карточки и список неправильных
    const options = [row.back_md, ...(row.distractors ?? [])].slice(0, OPTION_SLOTS);
    while (options.length < OPTION_SLOTS) options.push("");

    return {
      id: row.id,
      isNew: false,
      term: row.front_md,
      options,
      correctIndex: 0,
      example: row.example_md ?? "",
      link: row.link_url ?? "",
      mcq: row.mcq,
      tags: (row.card_tags ?? []).map((t) => t.tags.name).join(", "),
    };
  });

  return (
    <>
      <Link href="/topics" className="text-sm text-faint hover:text-ink">
        ← All decks
      </Link>
      <div className="mt-3">
        <DeckWorkspace
          deck={{
            id: topic.id as string,
            name: topic.name as string,
            description: (topic.description as string) ?? "",
            color: (topic.color as string) ?? "",
            parentName: (parent?.name as string) ?? null,
          }}
          initialCards={cards}
          allTags={((tagRows ?? []) as { name: string }[]).map((t) => t.name)}
        />
      </div>
    </>
  );
}
