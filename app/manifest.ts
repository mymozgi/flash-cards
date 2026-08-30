import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kartoteka",
    short_name: "Kartoteka",
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
    shortcuts: [
      { name: "Review", short_name: "Review", url: "/review" },
      { name: "New card", short_name: "New", url: "/cards/new" },
    ],
  };
}
