/** Изображение в редакторе: и уже сохранённое, и только что загруженное. */
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

export type EditorCard = {
  id: string;
  front_md: string;
  back_md: string;
  note_md: string;
  topicPath: string;
  tags: string[];
  frontImages: EditorImage[];
  backImages: EditorImage[];
};
