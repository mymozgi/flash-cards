import { getTopicTree } from "@/lib/data";
import { TopicManager } from "./topic-manager";

export default async function TopicsPage() {
  const topics = await getTopicTree();

  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Темы</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Тема отвечает на вопрос «откуда это», тег — «про что это». Имя темы уникально только
          среди соседних, поэтому одинаковые подтемы в разных ветках не конфликтуют.
        </p>
      </header>
      <TopicManager topics={topics} />
    </>
  );
}
