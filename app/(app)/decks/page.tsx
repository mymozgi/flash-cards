import { getDeckSummaries, getSettings, getTodayCounts } from "@/lib/data";
import { currentUser } from "@/lib/supabase/server";
import { DecksIndex } from "./decks-index";

export default async function DecksPage(props: {
  searchParams: Promise<{ new?: string; category?: string }>;
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
      /* Приход с экрана категории: список сразу сужен до её наборов.
         Фильтр в адресе, а не только в состоянии, — такую ссылку можно
         дать себе же в закладку и вернуться к тому же виду. */
      initialBranch={params.category ?? null}
      readOnly={!user}
    />
  );
}
