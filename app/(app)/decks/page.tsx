import { createClient } from "@/lib/supabase/server";
import { getSettings, getTodayCounts, getTopicTree } from "@/lib/data";
import { DecksIndex, type DeckSummary } from "./decks-index";

type Progress = {
  topic_id: string | null;
  total: number;
  memorized: number;
  last_used: string | null;
};

export default async function DecksPage(props: {
  searchParams: Promise<{ new?: string }>;
}) {
  const supabase = await createClient();
  const [params, topics, settings, { data: progress }] = await Promise.all([
    props.searchParams,
    getTopicTree(),
    getSettings(),
    supabase.from("topic_progress").select("topic_id,total,memorized,last_used"),
  ]);

  const counts = await getTodayCounts(settings);
  const byTopic = new Map<string, Progress>(
    ((progress ?? []) as Progress[])
      .filter((p) => p.topic_id)
      .map((p) => [p.topic_id as string, p]),
  );

  const byId = new Map(topics.map((t) => [t.id, t]));
  const decks: DeckSummary[] = topics.map((topic) => {
    const stats = byTopic.get(topic.id);
    const parent = topic.parent_id ? byId.get(topic.parent_id) : undefined;
    return {
      id: topic.id,
      name: topic.name,
      description: topic.description ?? "",
      color: topic.color ?? "",
      category: parent?.name ?? null,
      total: stats?.total ?? 0,
      memorized: stats?.memorized ?? 0,
      lastUsed: stats?.last_used ?? null,
    };
  });

  return <DecksIndex decks={decks} dueCount={counts.total} openCreate={params.new === "1"} />;
}
