import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Literata } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Картотека",
  description: "Личный тренажёр интервального повторения",
  applicationName: "Картотека",
  appleWebApp: { capable: true, title: "Картотека", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1412" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body
        className={`${plexSans.variable} ${plexMono.variable} ${literata.variable} font-sans antialiased`}
      >
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
