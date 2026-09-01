"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Switch } from "./ui/switch";
import { MoonIcon, SunIcon } from "./icons";

// Ключ намеренно оставлен прежним: переименование сбросило бы уже
// сделанный выбор темы у всех, кто открывал приложение раньше
const KEY = "kartoteka:theme";
const EVENT = "themechange";

/**
 * Тема читается из атрибута на <html>, а не из состояния компонента.
 *
 * Раньше переключатель стартовал со значения false и показывал «светлая»
 * даже при включённой тёмной — состояние компонента ничего не знало о том,
 * что скрипт в layout уже проставил тему до отрисовки. Атрибут — источник
 * правды, поэтому читаем его как внешнее хранилище.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isDark(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  // На сервере темы ещё нет: отдаём светлую, клиент поправит при гидратации
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  const set = useCallback((next: boolean) => {
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // приватный режим — тема просто не запомнится
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return (
    <span className="inline-flex items-center gap-2">
      <SunIcon className={`size-4 shrink-0 ${dark ? "text-faint" : "text-ink"}`} />
      <Switch checked={dark} onChange={set} label="Dark theme" />
      {!compact && (
        <MoonIcon className={`size-4 shrink-0 ${dark ? "text-ink" : "text-faint"}`} />
      )}
    </span>
  );
}
