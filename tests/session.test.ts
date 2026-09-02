import { describe, expect, it } from "vitest";
import { nextSpan, queueAfterGrade, queueAfterSkip, RELEARN_GAP } from "@/lib/session";

const deck = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

describe("очередь после оценки", () => {
  it("убирает карточку, если она не провалена", () => {
    expect(queueAfterGrade(deck(4), false, "c1")).toEqual(["c2", "c3", "c4"]);
  });

  it("возвращает провалённую через несколько карточек, а не сразу", () => {
    const next = queueAfterGrade(deck(8), true, "c1*");
    expect(next.indexOf("c1*")).toBe(RELEARN_GAP);
    expect(next).toHaveLength(8);
  });

  it("на короткой очереди ставит провалённую в конец, а не за её пределы", () => {
    const next = queueAfterGrade(deck(2), true, "c1*");
    expect(next).toEqual(["c2", "c1*"]);
  });

  it("на последней карточке провал оставляет её же", () => {
    expect(queueAfterGrade(deck(1), true, "c1*")).toEqual(["c1*"]);
  });
});

describe("очередь после пропуска", () => {
  it("отправляет карточку в конец", () => {
    expect(queueAfterSkip(deck(3), 1)).toEqual(["c2", "c3", "c1"]);
  });

  it("на втором пропуске выбрасывает карточку из сессии", () => {
    expect(queueAfterSkip(deck(3), 2)).toEqual(["c2", "c3"]);
  });

  it("не трогает очередь из одной карточки: перекладывать некуда", () => {
    expect(queueAfterSkip(deck(1), 1)).toEqual(["c1"]);
  });

  it("не зацикливается: пропуская всё подряд, сессия кончается", () => {
    let queue = deck(3);
    const times = new Map<string, number>();
    // 20 попыток заведомо больше, чем 3 карточки × предел в 2 пропуска
    for (let i = 0; i < 20 && queue.length > 1; i++) {
      const head = queue[0];
      const n = (times.get(head) ?? 0) + 1;
      times.set(head, n);
      queue = queueAfterSkip(queue, n);
    }
    expect(queue).toHaveLength(1);
  });
});

describe("знаменатель полосы прогресса", () => {
  it("растёт, когда карточка вернулась на переучивание", () => {
    expect(nextSpan(10, 4, "relearn")).toBe(11);
  });

  it("уменьшается, когда карточка выбыла по пропуску", () => {
    expect(nextSpan(10, 4, "skip-drop")).toBe(9);
  });

  it("никогда не опускается ниже уже сделанного", () => {
    expect(nextSpan(7, 7, "skip-drop")).toBe(7);
  });

  it("после провала и последующего пропуска возвращается к исходному", () => {
    const grown = nextSpan(10, 0, "relearn");
    expect(nextSpan(grown, 0, "skip-drop")).toBe(10);
  });
});
