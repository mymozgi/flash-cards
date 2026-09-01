import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Пакет server-only падает вне окружения RSC. В тестах чистой логики
      // он не нужен — подменяем пустышкой, а не выносим его из lib/cards.ts:
      // защита от импорта на клиенте должна остаться в рабочем коде.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
