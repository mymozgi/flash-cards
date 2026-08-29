import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Картотека",
    short_name: "Картотека",
    description: "Личный тренажёр интервального повторения",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ru",
    background_color: "#0e1412",
    theme_color: "#0e6e5b",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android обрезает иконку под форму системы — этой оставлено поле по краям
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Повторение", short_name: "Повторять", url: "/review" },
      { name: "Новая карточка", short_name: "Новая", url: "/cards/new" },
    ],
  };
}
