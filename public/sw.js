/**
 * Сервис-воркер Картотеки.
 *
 * Задача скромная и честная: приложение открывается с домашнего экрана
 * мгновенно и не показывает диноазавра при провале сети. Полноценная работа
 * без сети — очередь в IndexedDB и отложенная отправка оценок — это этап 4,
 * здесь её нет: оценка без сети не сохранится.
 *
 * Стратегии:
 *   переходы по страницам  — сеть, при отказе кэш, затем офлайн-заглушка
 *   /_next/static, иконки  — кэш (файлы неизменяемы, имя содержит хэш)
 *   картинки карточек      — кэш, параллельно обновление в фоне
 *   всё остальное          — только сеть (авторизация, PostgREST, действия)
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const MEDIA = `media-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MEDIA_LIMIT = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
    await cache.delete(key);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Переходы по страницам: свежесть важнее скорости — данные очереди
  // не должны приезжать вчерашними
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Неизменяемая статика Next и иконки
  if (sameOrigin && (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".png"))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Картинки карточек из публичного бакета Supabase
  if (url.pathname.includes("/storage/v1/object/public/cards/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(MEDIA)
                .then((cache) => cache.put(request, copy))
                .then(() => trimCache(MEDIA, MEDIA_LIMIT));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
