"use client";

import { useState } from "react";
import type { TagSlice } from "@/lib/tag-stats";

/**
 * Доли областей знания по тегам.
 *
 * Форма — горизонтальная полоса «часть от целого», а не круговая диаграмма.
 * Причина измеримая, а не вкусовая: круговая сравнивает каждый сектор с каждым,
 * и на такой задаче палитра честно вытягивает лишь три различимых цвета —
 * четвёртый сливается с синим при протанопии (ΔE 1.9 при пороге 8). Полоса
 * сравнивает соседей, и там те же шесть цветов проходят все проверки в обеих
 * темах: худшая соседняя пара ΔE 9,1 в светлой и 8,4 в тёмной.
 *
 * Цвета заданы явными значениями, а не токенами темы: они проверены скриптом
 * ровно в этих значениях, и подмена сломала бы проверку.
 */
export function TagShare({ slices }: { slices: TagSlice[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (slices.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface py-12 text-center text-sm text-muted">
        No tags yet. Tag a few cards and this will show which areas your deck actually covers.
      </p>
    );
  }

  return (
    <figure className="m-0">
      {/* Полоса: 2 px просвета между долями — иначе соседние цвета сливаются
          в один блок и граница читается как оттенок */}
      <div className="flex h-10 w-full gap-0.5 overflow-hidden rounded-lg" role="img"
        aria-label={slices
          .map((s) => `${s.name}: ${Math.round(s.share * 100)}%`)
          .join(", ")}
      >
        {slices.map((slice) => (
          <div
            key={slice.name}
            onMouseEnter={() => setHovered(slice.name)}
            onMouseLeave={() => setHovered(null)}
            title={`${slice.name} — ${slice.total} cards, ${Math.round(slice.share * 100)}%`}
            style={{
              width: `${Math.max(slice.share * 100, 1.5)}%`,
              background: slice.slot < 0 ? "var(--line-strong)" : undefined,
            }}
            className={`h-full transition-opacity first:rounded-l-lg last:rounded-r-lg ${
              hovered && hovered !== slice.name ? "opacity-45" : ""
            } ${slice.slot >= 0 ? `tag-hue-${slice.slot}` : ""}`}
          />
        ))}
      </div>

      {/* Легенда обязательна: идентичность не должна держаться на одном цвете */}
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((slice) => (
          <span
            key={slice.name}
            onMouseEnter={() => setHovered(slice.name)}
            onMouseLeave={() => setHovered(null)}
            className={`inline-flex items-center gap-2 text-sm ${
              hovered && hovered !== slice.name ? "opacity-45" : ""
            }`}
          >
            <span
              aria-hidden
              style={{ background: slice.slot < 0 ? "var(--line-strong)" : undefined }}
              className={`size-2.5 shrink-0 rounded-sm ${slice.slot >= 0 ? `tag-hue-${slice.slot}` : ""}`}
            />
            <span className="text-ink">{slice.name}</span>
            <span className="tabular-nums text-faint">{Math.round(slice.share * 100)}%</span>
          </span>
        ))}
      </figcaption>

    </figure>
  );
}
