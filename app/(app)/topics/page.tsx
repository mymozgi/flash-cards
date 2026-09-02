import { redirect } from "next/navigation";

/**
 * Прежний экран «Manage categories» переехал в раздел Knowledge.
 *
 * Здесь редирект, а не копия: две страницы над одной таблицей — это и есть
 * тот дубль, ради устранения которого раздел затевался. Ссылки из закладок
 * и из старых записей продолжают работать.
 */
export default function TopicsPage() {
  redirect("/knowledge");
}
