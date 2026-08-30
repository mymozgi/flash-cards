import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { CardState, SchedulingRow } from "./types";

export const RATINGS = [
  { grade: Rating.Again as Grade, key: "1", label: "Again", hint: "no recall" },
  { grade: Rating.Hard as Grade, key: "2", label: "Hard", hint: "with effort" },
  { grade: Rating.Good as Grade, key: "3", label: "Good", hint: "as expected" },
  { grade: Rating.Easy as Grade, key: "4", label: "Easy", hint: "instant" },
] as const;

const STATE_TO_DB: Record<State, CardState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const DB_TO_STATE: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export function scheduler(requestRetention: number) {
  return fsrs(
    generatorParameters({
      request_retention: requestRetention,
      // фаззинг разводит карточки, созданные одной пачкой, по разным дням —
      // иначе весь импорт возвращается в очередь единым комом
      enable_fuzz: true,
    }),
  );
}

export function toFsrsCard(row: SchedulingRow): FsrsCard {
  if (row.state === "new" && row.reps === 0) {
    return createEmptyCard(new Date(row.due));
  }
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: DB_TO_STATE[row.state],
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fromFsrsCard(cardId: string, card: FsrsCard) {
  return {
    card_id: cardId,
    state: STATE_TO_DB[card.state],
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Интервалы для подписей на кнопках оценки (§8.1). */
export function previewIntervals(
  row: SchedulingRow,
  requestRetention: number,
  now: Date = new Date(),
): Record<Grade, string> {
  const preview = scheduler(requestRetention).repeat(toFsrsCard(row), now);
  const out = {} as Record<Grade, string>;
  for (const { grade } of RATINGS) {
    out[grade] = humanInterval(preview[grade].card.due, now);
  }
  return out;
}

export function humanInterval(due: Date, from: Date = new Date()): string {
  const minutes = Math.round((due.getTime() - from.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} d`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} mo`;
  return `${(days / 365).toFixed(1)} y`;
}
