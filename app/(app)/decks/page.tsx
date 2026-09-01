import { getDeckSummaries, getSettings, getTodayCounts } from "@/lib/data";
import { DecksIndex } from "./decks-index";

export default async function DecksPage(props: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [params, decks, settings] = await Promise.all([
    props.searchParams,
    getDeckSummaries(),
    getSettings(),
  ]);
  const counts = await getTodayCounts(settings);

  return <DecksIndex decks={decks} dueCount={counts.total} openCreate={params.new === "1"} />;
}
