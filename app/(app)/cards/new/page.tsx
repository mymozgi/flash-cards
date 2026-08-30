import { getTags, getTopicTree } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { CardEditor } from "../editor";

export default async function NewCardPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, user, topics, tags] = await Promise.all([
    props.searchParams,
    requireUser(),
    getTopicTree(),
    getTags(),
  ]);

  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">New card</h1>
        {saved === "1" && (
          <p className="mt-2 text-sm text-accent">Saved. Ready for the next one.</p>
        )}
      </header>
      <div className="mt-6">
        <CardEditor
          userId={user.id}
          topicPaths={topics.map((t) => t.path)}
          knownTags={tags.map((t) => t.name)}
        />
      </div>
    </>
  );
}
