import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// У Poppins нет кириллицы: интерфейс английский, и для него шрифт подходит,
// а русский текст карточек подхватит запасной стек — это задано в globals.css
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});
import { RegisterServiceWorker } from "@/components/register-sw";

// Тему ставим до первой отрисовки, иначе на тёмной системе мелькает вспышка.
// Ключ хранилища остался прежним — см. components/theme-toggle.tsx
const THEME_BOOT = `try{document.documentElement.dataset.theme=localStorage.getItem("kartoteka:theme")||"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export const metadata: Metadata = {
  title: "Memorizer",
  description: "A personal spaced-repetition trainer",
  applicationName: "Memorizer",
  appleWebApp: { capable: true, title: "Memorizer", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1318" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body
        className={`${poppins.variable} font-sans antialiased`}
      >
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
