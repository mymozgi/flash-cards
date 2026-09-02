"use client";

/**
 * Единственное место, где рисуется полотно карточки.
 *
 * Этим же компонентом живут предпросмотр в редакторе, режим просмотра колоды
 * и экран повторения: иначе редактор и учебный экран неизбежно разъезжаются,
 * и «в превью было по-другому» становится обычным делом.
 */
export type CardShape = "square" | "landscape" | "portrait";
export type CardLayout = "full_image" | "split";
export type ImagePosition = "left" | "right" | "top" | "bottom";

export type CardImage = { url: string; caption?: string | null };

export const ASPECT: Record<CardShape, string> = {
  square: "1 / 1",
  landscape: "3 / 2",
  portrait: "2 / 3",
};

/**
 * То же отношение числом — для мест, где рамку карточки считают в CSS.
 * `aspect-ratio` вместе с `max-height` пропорцию не сохраняет: при заданной
 * ширине потолок высоты её просто обрезает, и карточка 2:3 выходит пейзажем.
 * Поэтому ширину приходится вычислять из допустимой высоты, а для этого нужно
 * число, а не строка «2 / 3».
 */
export const ASPECT_RATIO: Record<CardShape, number> = {
  square: 1,
  landscape: 3 / 2,
  portrait: 2 / 3,
};

export const SHAPE_OPTIONS: { key: CardShape; label: string; ratio: string; box: string }[] = [
  { key: "square", label: "Square", ratio: "1:1", box: "h-6 w-6" },
  { key: "landscape", label: "Landscape", ratio: "3:2", box: "h-5 w-7" },
  { key: "portrait", label: "Portrait", ratio: "2:3", box: "h-7 w-5" },
];

export const LAYOUT_OPTIONS: { key: CardLayout; label: string }[] = [
  { key: "full_image", label: "Full image" },
  { key: "split", label: "Split" },
];

export const POSITION_OPTIONS: { key: ImagePosition; label: string; forShape: "row" | "column" }[] = [
  { key: "left", label: "Image left", forShape: "row" },
  { key: "right", label: "Image right", forShape: "row" },
  { key: "top", label: "Image top", forShape: "column" },
  { key: "bottom", label: "Image bottom", forShape: "column" },
];

export function CardRenderer({
  shape,
  layout,
  imagePosition,
  html,
  images,
  maxHeight,
  onImageClick,
  fill = false,
  className = "",
}: {
  shape: CardShape;
  layout: CardLayout;
  imagePosition: ImagePosition;
  /** уже отрендеренный Markdown */
  html: string;
  images: CardImage[];
  maxHeight?: string;
  onImageClick?: (index: number) => void;
  /** пропорции задаёт родитель — например грань переворачивающейся карточки */
  fill?: boolean;
  className?: string;
}) {
  const image = images[0];
  const hasImage = Boolean(image);
  const sideways = imagePosition === "left" || imagePosition === "right";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(17,24,39,.06),0_12px_28px_-18px_rgba(17,24,39,.45)] ${className}`}
      style={fill ? undefined : { aspectRatio: ASPECT[shape], maxHeight }}
    >
      {layout === "full_image" && hasImage ? (
        <>
          <Picture image={image} className="absolute inset-0 size-full" onClick={onImageClick} />
          {/* затемнение снизу: без него белый текст теряется на светлой картинке */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent p-4 sm:p-5">
            <div
              className="prose-card max-h-[45%] overflow-y-auto text-center text-white [&_a]:text-white [&_ul]:inline-block [&_ul]:text-left [&_ol]:inline-block [&_ol]:text-left"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </>
      ) : hasImage ? (
        <div
          className={`flex size-full ${
            sideways ? "flex-col sm:flex-row" : "flex-col"
          } ${
            imagePosition === "right"
              ? "sm:flex-row-reverse"
              : imagePosition === "bottom"
                ? "flex-col-reverse"
                : ""
          }`}
        >
          <Picture
            image={image}
            className={sideways ? "h-1/2 w-full sm:h-full sm:w-1/2" : "h-1/2 w-full"}
            onClick={onImageClick}
          />
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-4 text-center sm:p-5">
            <div className="prose-card w-full [&_ul]:inline-block [&_ul]:text-left [&_ol]:inline-block [&_ol]:text-left" dangerouslySetInnerHTML={{ __html: html }} />
            {image?.caption && <p className="mt-2 text-xs text-faint">{image.caption}</p>}
          </div>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center overflow-y-auto p-5 sm:p-7">
          <div
            className="prose-card w-full text-center text-lg sm:text-xl [&_ul]:inline-block [&_ul]:text-left [&_ol]:inline-block [&_ol]:text-left"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}

function Picture({
  image,
  className,
  onClick,
}: {
  image?: CardImage;
  className: string;
  onClick?: (index: number) => void;
}) {
  if (!image) return null;

  const picture = (
    // обычный img: файлы уже сжаты клиентом, оптимизация Vercel лимитирована
    <img src={image.url} alt={image.caption ?? ""} className="size-full object-cover" />
  );

  if (!onClick) return <div className={className}>{picture}</div>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(0);
      }}
      aria-label={image.caption ?? "Open image full screen"}
      className={`${className} block`}
    >
      {picture}
    </button>
  );
}
