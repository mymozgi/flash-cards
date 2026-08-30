import { getTopicTree } from "@/lib/data";
import { TopicManager } from "./topic-manager";

export default async function TopicsPage() {
  const topics = await getTopicTree();

  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Topics</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          A topic answers “where is this from”, a tag answers “what is it about”. Topic names are
          unique only among siblings, so identical subtopics in different branches never collide.
        </p>
      </header>
      <TopicManager topics={topics} />
    </>
  );
}
