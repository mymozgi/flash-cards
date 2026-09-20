import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Memorizer",
    short_name: "Memorizer",
    description: "A personal spaced-repetition trainer",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    background_color: "#f4f6f8",
    theme_color: "#2563eb",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android обрезает иконку под форму системы — этой оставлено поле по краям
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    /*
      Ярлыки по долгому нажатию на иконку установленного приложения.
      Адрес здесь обязан существовать: промахнувшийся ярлык открывает 404 из
      системного меню, и починить это можно только переустановкой. «New card»
      вёл на /cards/new, которого в приложении нет — карточку заводят внутри
      набора, отдельного маршрута у неё не было никогда.
    */
    shortcuts: [
      { name: "Review", short_name: "Review", url: "/review" },
      { name: "My flashcards", short_name: "Cards", url: "/decks" },
    ],
  };
}
