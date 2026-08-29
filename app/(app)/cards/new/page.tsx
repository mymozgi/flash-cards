import { getTags, getTopicTree } from "@/lib/data";
import { CardEditor } from "../editor";

export default async function NewCardPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, topics, tags] = await Promise.all([
    props.searchParams,
    getTopicTree(),
    getTags(),
  ]);

  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Новая карточка</h1>
        {saved === "1" && (
          <p className="mt-2 text-sm text-accent">Сохранено. Можно вводить следующую.</p>
        )}
      </header>
      <div className="mt-6">
        <CardEditor topicPaths={topics.map((t) => t.path)} knownTags={tags.map((t) => t.name)} />
      </div>
    </>
  );
}
