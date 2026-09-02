/**
 * Заготовки для пустого раздела.
 *
 * Это предложение, а не схема: ничего из этого не создаётся само, у созданного
 * нет пометки «системная», и удаляется оно как любая другая категория. Цвета
 * взяты из проверенной палитры тегов — те же шесть оттенков, что различимы при
 * дальтонизме, плюс повтор по кругу.
 */
export type Starter = { name: string; icon: string; color: string };

const HUES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

const NAMES: [string, string][] = [
  ["Psychology", "🧠"],
  ["Biology", "🧬"],
  ["Physics", "⚛️"],
  ["Economics", "💰"],
  ["Programming", "💻"],
  ["Design", "🎨"],
  ["Language", "🗣️"],
  ["History", "🏛️"],
  ["Philosophy", "📜"],
  ["Business", "📈"],
  ["Books", "📚"],
];

export const STARTERS: Starter[] = NAMES.map(([name, icon], index) => ({
  name,
  icon,
  color: HUES[index % HUES.length],
}));
