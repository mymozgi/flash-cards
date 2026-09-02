export type CardState = "new" | "learning" | "review" | "relearning";
export type CardSide = "front" | "back";
export type CardKind = "basic" | "reversed_of";

export type TopicRow = {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
  description: string | null;
  color: string | null;
  image_path: string | null;
};

/** Тема вместе с полным путём — читаемый адрес узла (§6.1). */
export type TopicNode = TopicRow & {
  path: string;
  depth: number;
  cardCount: number;
};

/** Набор с прогрессом — то, что показывает карточка колоды. */
export type DeckSummary = {
  id: string;
  name: string;
  description: string;
  color: string;
  /** Готовый адрес обложки; пустая строка — обложки нет. */
  cover: string;
  category: string | null;
  total: number;
  memorized: number;
  lastUsed: string | null;
};

export type TagRow = {
  id: string;
  name: string;
  slot: number | null;
};

export type CardShape = "square" | "landscape" | "portrait";

export type CardLayout = "full_image" | "split";
export type ImagePosition = "left" | "right" | "top" | "bottom";

export type CardRow = {
  id: string;
  topic_id: string | null;
  shape: CardShape;
  layout: CardLayout;
  image_position: ImagePosition;
  front_md: string;
  back_md: string;
  note_md: string | null;
  kind: CardKind;
  suspended: boolean;
  created_at: string;
  updated_at: string;
};

export type SchedulingRow = {
  card_id: string;
  state: CardState;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_review: string | null;
};

export type SettingsRow = {
  daily_new_limit: number;
  daily_review_limit: number;
  request_retention: number;
  timezone: string;
};

/** Изображение в редакторе: путь для сервера плюс адреса для показа. */
export type EditorImage = {
  storagePath: string;
  thumbPath: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
  caption: string;
};

export type MediaItem = {
  id: string;
  side: CardSide;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  caption: string | null;
  position: number;
};

/** Карточка в очереди повторения — всё, что нужно экрану сессии. */
/** Тег в том виде, в каком его показывают: имя плюс ячейка палитры. */
export type CardTag = { name: string; slot: number | null };

export type QueueCard = {
  card: CardRow;
  scheduling: SchedulingRow;
  topicPath: string | null;
  tags: CardTag[];
  media: MediaItem[];
};
