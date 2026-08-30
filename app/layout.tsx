import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";

// Тему ставим до первой отрисовки, иначе на тёмной системе мелькает вспышка
const THEME_BOOT = `try{document.documentElement.dataset.theme=localStorage.getItem("kartoteka:theme")||"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export const metadata: Metadata = {
  title: "Kartoteka",
  description: "A personal spaced-repetition trainer",
  applicationName: "Kartoteka",
  appleWebApp: { capable: true, title: "Kartoteka", statusBarStyle: "default" },
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
        className="font-sans antialiased"
      >
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
