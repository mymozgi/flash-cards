"use client";

import { useEffect } from "react";

/**
 * Регистрация сервис-воркера. Только в собранном приложении: в режиме
 * разработки закэшированные чанки Next конфликтуют с горячей перезагрузкой.
 * Проверить локально — `npm run build && npm start`.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // офлайн-заглушка — приятное дополнение, а не условие работы
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
