"use client";

import { useState } from "react";

const KEY = "kartoteka:theme";

/**
 * Тема хранится в localStorage и проставляется атрибутом на <html> ещё до
 * отрисовки — скриптом в layout, иначе на тёмной системе мелькала бы вспышка.
 * Значение по умолчанию — светлая.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  const flip = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setDark(next === "dark");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* приватный режим — тема просто не запомнится */
    }
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label="Switch theme"
      className="px-2 py-4 text-sm text-faint hover:text-ink"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
