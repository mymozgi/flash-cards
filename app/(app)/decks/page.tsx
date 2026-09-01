import { getDeckSummaries, getSettings, getTodayCounts } from "@/lib/data";
import { currentUser } from "@/lib/supabase/server";
import { DecksIndex } from "./decks-index";

export default async function DecksPage(props: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [params, user, decks] = await Promise.all([
    props.searchParams,
    currentUser(),
    getDeckSummaries(),
  ]);

  // Гостю не считаем очередь: она про расписание владельца и требует сессии
  const dueCount = user ? (await getTodayCounts(await getSettings())).total : 0;

  return (
    <DecksIndex
      decks={decks}
      dueCount={dueCount}
      openCreate={Boolean(user) && params.new === "1"}
      readOnly={!user}
    />
  );
}
