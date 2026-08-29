import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Изображения карточек отдаём обычным <img>. Файлы уже сжаты на клиенте
    // (WebP, до 1600 px), а оптимизация next/image на тарифе Vercel Hobby
    // лимитирована и платна сверх лимита. См. CLAUDE.md.
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
