import { notFound } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getTags, getTopicTree } from "@/lib/data";
import { humanInterval } from "@/lib/fsrs";
import { publicUrl } from "@/lib/storage";
import { CardEditor } from "../editor";
import { deleteCard, setSuspended } from "../actions";
import type { EditorImage } from "../editor-types";

const STATE_LABELS: Record<string, string> = {
  new: "new",
  learning: "learning",
  review: "review",
  relearning: "relearning",
};

type MediaRow = {
  side: "front" | "back";
  storage_path: string;
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  caption: string | null;
  position: number;
};

export default async function EditCardPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: card }, user, topics, allTags] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id,topic_id,front_md,back_md,note_md,suspended,deleted_at, card_tags(tags(name)), scheduling(state,due,reps,lapses), media(side,storage_path,thumb_path,width,height,bytes,caption,position)",
      )
      .eq("id", id)
      .maybeSingle(),
    requireUser(),
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

  const toEditorImage = (row: MediaRow): EditorImage => ({
    storagePath: row.storage_path,
    thumbPath: row.thumb_path,
    url: publicUrl(row.storage_path),
    thumbUrl: publicUrl(row.thumb_path),
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    caption: row.caption ?? "",
  });

  const media = ((card.media ?? []) as unknown as MediaRow[]).sort(
    (a, b) => a.position - b.position,
  );

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
        <h1 className="font-display text-3xl font-semibold tracking-tight">Card</h1>
        {scheduling && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.13em] text-faint">
            {STATE_LABELS[scheduling.state] ?? scheduling.state} · due in{" "}
            {humanInterval(new Date(scheduling.due))} · reps {scheduling.reps} · lapses{" "}
            {scheduling.lapses}
          </p>
        )}
      </header>

      <div className="mt-6">
        <CardEditor
          userId={user.id}
          card={{
            id: card.id as string,
            front_md: card.front_md as string,
            back_md: card.back_md as string,
            note_md: (card.note_md as string) ?? "",
            topicPath,
            tags: tagNames,
            frontImages: media.filter((m) => m.side === "front").map(toEditorImage),
            backImages: media.filter((m) => m.side === "back").map(toEditorImage),
          }}
          topicPaths={topics.map((t) => t.path)}
          knownTags={allTags.map((t) => t.name)}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-5 text-sm">
        <form action={suspendAction}>
          <button type="submit" className="rounded border border-line px-4 py-2 text-muted hover:text-ink">
            {card.suspended ? "Resume" : "Suspend"}
          </button>
        </form>
        <form action={deleteAction}>
          <button type="submit" className="rounded border border-line px-4 py-2 text-rust">
            Delete
          </button>
        </form>
      </div>
    </>
  );
}
