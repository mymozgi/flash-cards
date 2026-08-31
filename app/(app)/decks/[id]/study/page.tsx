import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mediaForCards } from "@/lib/data";
import { StudyDeck, type StudyCard } from "./study-deck";
import type { CardLayout, CardShape, ImagePosition } from "@/components/card-renderer";

type Row = {
  id: string;
  front_md: string;
  back_md: string;
  example_md: string | null;
  link_url: string | null;
  shape: CardShape;
  layout: CardLayout;
  image_position: ImagePosition;
};

export default async function StudyPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: topic }, { data: rows }] = await Promise.all([
    supabase.from("topics").select("id,name").eq("id", id).maybeSingle(),
    supabase
      .from("cards")
      .select("id,front_md,back_md,example_md,link_url,shape,layout,image_position")
      .eq("topic_id", id)
      .is("deleted_at", null)
      .eq("suspended", false)
      .order("position")
      .order("created_at"),
  ]);

  if (!topic) notFound();

  const list = (rows ?? []) as unknown as Row[];
  const media = await mediaForCards(list.map((r) => r.id));

  const cards: StudyCard[] = list.map((row) => {
    const attached = media.get(row.id) ?? [];
    return {
      id: row.id,
      term: row.front_md,
      answer: row.back_md,
      example: row.example_md ?? "",
      link: row.link_url ?? "",
      shape: row.shape,
      layout: row.layout,
      imagePosition: row.image_position,
      frontImages: attached
        .filter((m) => m.side === "front")
        .map((m) => ({ url: m.url, caption: m.caption })),
      backImages: attached
        .filter((m) => m.side === "back")
        .map((m) => ({ url: m.url, caption: m.caption })),
    };
  });

  return <StudyDeck deckId={topic.id as string} deckName={topic.name as string} cards={cards} />;
}
