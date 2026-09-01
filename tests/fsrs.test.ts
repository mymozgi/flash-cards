import { describe, expect, it } from "vitest";
import { Rating, State, type Grade } from "ts-fsrs";
import { fromFsrsCard, humanInterval, previewIntervals, scheduler, toFsrsCard } from "@/lib/fsrs";
import type { SchedulingRow } from "@/lib/types";

/**
 * Планировщик — единственная часть приложения, ошибка в которой не заметна
 * сразу: неверный интервал проявится через недели, когда материал уже забыт.
 * Поэтому маппинг строки БД в карточку FSRS и обратно проверяется явно.
 */
function row(overrides: Partial<SchedulingRow> = {}): SchedulingRow {
  return {
    card_id: "00000000-0000-0000-0000-000000000001",
    state: "review",
    due: "2026-03-15T10:00:00.000Z",
    stability: 12.5,
    difficulty: 5.2,
    elapsed_days: 7,
    scheduled_days: 14,
    learning_steps: 0,
    reps: 4,
    lapses: 1,
    last_review: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("маппинг строки БД ↔ карточки FSRS", () => {
  it("переводит состояние в обе стороны без потерь", () => {
    const states: SchedulingRow["state"][] = ["new", "learning", "review", "relearning"];
    for (const state of states) {
      const source = row({ state, reps: 3 });
      const mapped = fromFsrsCard(source.card_id, toFsrsCard(source));
      expect(mapped.state).toBe(state);
    }
  });

  it("сохраняет числовые поля при обходе туда и обратно", () => {
    const source = row();
    const mapped = fromFsrsCard(source.card_id, toFsrsCard(source));
    expect(mapped.stability).toBe(source.stability);
    expect(mapped.difficulty).toBe(source.difficulty);
    expect(mapped.reps).toBe(source.reps);
    expect(mapped.lapses).toBe(source.lapses);
    expect(mapped.due).toBe(source.due);
    expect(mapped.last_review).toBe(source.last_review);
  });

  it("нетронутую карточку отдаёт как пустую карточку FSRS", () => {
    const fresh = toFsrsCard(row({ state: "new", reps: 0, stability: 0, difficulty: 0 }));
    expect(fresh.state).toBe(State.New);
    expect(fresh.reps).toBe(0);
    expect(fresh.last_review).toBeUndefined();
  });

  it("не теряет last_review, когда его нет", () => {
    const mapped = fromFsrsCard("id", toFsrsCard(row({ last_review: null, reps: 1 })));
    expect(mapped.last_review).toBeNull();
  });
});

describe("расчёт следующего показа", () => {
  const now = new Date("2026-03-15T10:00:00.000Z");

  it("«Снова» возвращает карточку в переучивание и в ближайшие минуты", () => {
    const { card } = scheduler(0.9).next(toFsrsCard(row()), now, Rating.Again as Grade);
    expect(card.state).toBe(State.Relearning);
    expect(card.due.getTime() - now.getTime()).toBeLessThan(60 * 60 * 1000);
    expect(card.lapses).toBe(2);
  });

  it("оценки расположены по возрастанию интервала", () => {
    const source = toFsrsCard(row());
    const f = scheduler(0.9);
    const again = f.next(source, now, Rating.Again as Grade).card.due.getTime();
    const hard = f.next(source, now, Rating.Hard as Grade).card.due.getTime();
    const good = f.next(source, now, Rating.Good as Grade).card.due.getTime();
    const easy = f.next(source, now, Rating.Easy as Grade).card.due.getTime();

    expect(again).toBeLessThan(hard);
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });

  it("более высокая цель удержания даёт более короткий интервал", () => {
    const source = toFsrsCard(row());
    const relaxed = scheduler(0.8).next(source, now, Rating.Good as Grade).card.due.getTime();
    const strict = scheduler(0.95).next(source, now, Rating.Good as Grade).card.due.getTime();
    expect(strict).toBeLessThan(relaxed);
  });

  it("превью даёт подпись для каждой из четырёх кнопок", () => {
    const preview = previewIntervals(row(), 0.9, now);
    expect(Object.keys(preview)).toHaveLength(4);
    for (const label of Object.values(preview)) {
      expect(label).toMatch(/^(now|\d+(\.\d+)? (min|h|d|mo|y))$/);
    }
  });
});

describe("humanInterval", () => {
  const from = new Date("2026-03-15T10:00:00.000Z");
  const at = (ms: number) => humanInterval(new Date(from.getTime() + ms), from);

  it("округляет по нарастающим единицам", () => {
    // граница «now» проходит по половине минуты: 20 с округляются вниз, 30 с — вверх
    expect(at(20 * 1000)).toBe("now");
    expect(at(30 * 1000)).toBe("1 min");
    expect(at(10 * 60 * 1000)).toBe("10 min");
    expect(at(3 * 3600 * 1000)).toBe("3 h");
    expect(at(5 * 86400 * 1000)).toBe("5 d");
    expect(at(60 * 86400 * 1000)).toBe("2 mo");
    expect(at(730 * 86400 * 1000)).toBe("2.0 y");
  });

  it("прошедшее время показывает как «сейчас», а не отрицательным", () => {
    expect(at(-5 * 86400 * 1000)).toBe("now");
  });
});
