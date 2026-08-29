import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTags, getTopicTree } from "@/lib/data";
import { humanInterval } from "@/lib/fsrs";
import { CardEditor } from "../editor";
import { deleteCard, setSuspended } from "../actions";

const STATE_LABELS: Record<string, string> = {
  new: "новая",
  learning: "изучение",
  review: "повторение",
  relearning: "переучивание",
};

export default async function EditCardPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: card }, topics, allTags] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id,topic_id,front_md,back_md,note_md,suspended,deleted_at, card_tags(tags(name)), scheduling(state,due,reps,lapses)",
      )
      .eq("id", id)
      .maybeSingle(),
    getTopicTree(),
    getTags(),
  ]);

  if (!card || card.deleted_at) notFound();

  const tagNames = ((card.card_tags ?? []) as unknown as { tags: { name: string } }[]).map(
    (row) => row.tags.name,
  );
  const scheduling = (Array.isArray(card.scheduling) ? card.scheduling[0] : card.scheduling) as
    | { state: string; due: string; reps: number; lapses: number }
    | undefined;
  const topicPath = topics.find((t) => t.id === card.topic_id)?.path ?? "";

  const suspendAction = async () => {
    "use server";
    await setSuspended(id, !card.suspended);
  };
  const deleteAction = async () => {
    "use server";
    await deleteCard(id);
  };

  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Карточка</h1>
        {scheduling && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.13em] text-faint">
            {STATE_LABELS[scheduling.state] ?? scheduling.state} · показ через{" "}
            {humanInterval(new Date(scheduling.due))} · повторов {scheduling.reps} · провалов{" "}
            {scheduling.lapses}
          </p>
        )}
      </header>

      <div className="mt-6">
        <CardEditor
          card={{
            id: card.id as string,
            front_md: card.front_md as string,
            back_md: card.back_md as string,
            note_md: (card.note_md as string) ?? "",
            topicPath,
            tags: tagNames,
          }}
          topicPaths={topics.map((t) => t.path)}
          knownTags={allTags.map((t) => t.name)}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-5 text-sm">
        <form action={suspendAction}>
          <button type="submit" className="rounded border border-line px-4 py-2 text-muted hover:text-ink">
            {card.suspended ? "Вернуть в очередь" : "Приостановить"}
          </button>
        </form>
        <form action={deleteAction}>
          <button type="submit" className="rounded border border-line px-4 py-2 text-rust">
            Удалить
          </button>
        </form>
      </div>
    </>
  );
}
