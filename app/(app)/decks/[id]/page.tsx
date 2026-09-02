import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, requireUser } from "@/lib/supabase/server";
import { mediaForCards } from "@/lib/data";
import { publicUrl } from "@/lib/storage";
import type { DeckCard } from "./deck-workspace";
import { DeckWorkspace } from "./deck-workspace";


const OPTION_SLOTS = 5;

type CardRow = {
  id: string;
  front_md: string;
  back_md: string;
  example_md: string | null;
  note_md: string | null;
  suspended: boolean;
  mcq: boolean;
  shape: "square" | "landscape" | "portrait";
  layout: "full_image" | "split";
  image_position: "left" | "right" | "top" | "bottom";
  distractors: string[] | null;
  card_tags: { tags: { name: string } }[];
};

export default async function DeckPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id,name,description,color,image_path,parent_id")
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
        "id,front_md,back_md,note_md,suspended,example_md,mcq,shape,layout,image_position,distractors, card_tags(tags(name))",
      )
      .eq("topic_id", id)
      .is("deleted_at", null)
      .order("position")
      .order("created_at"),
    supabase.from("tags").select("name").order("name"),
  ]);

  const [user, media] = await Promise.all([
    requireUser(),
    mediaForCards(((rows ?? []) as unknown as CardRow[]).map((r) => r.id)),
  ]);

  const cards: DeckCard[] = ((rows ?? []) as unknown as CardRow[]).map((row) => {
    const attached = media.get(row.id) ?? [];
    const toEditor = (side: "front" | "back") =>
      attached
        .filter((m) => m.side === side)
        .map((m) => ({
          storagePath: m.url.split("/public/cards/")[1] ?? "",
          thumbPath: m.thumbUrl.split("/public/cards/")[1] ?? "",
          url: m.url,
          thumbUrl: m.thumbUrl,
          width: m.width,
          height: m.height,
          bytes: 0,
          caption: m.caption ?? "",
        }));

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
      note: row.note_md ?? "",
      suspended: row.suspended,
      mcq: row.mcq,
      tags: (row.card_tags ?? []).map((t) => t.tags.name).join(", "),
      shape: row.shape,
      layout: row.layout,
      imagePosition: row.image_position,
      frontImages: toEditor("front"),
      backImages: toEditor("back"),
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
            cover: (topic.image_path as string) ?? null,
            coverUrl: topic.image_path ? publicUrl(topic.image_path as string) : "",
            parentName: (parent?.name as string) ?? null,
          }}
          initialCards={cards}
          allTags={((tagRows ?? []) as { name: string }[]).map((t) => t.name)}
          userId={user.id}
        />
      </div>
    </>
  );
}
