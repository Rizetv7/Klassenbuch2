import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/Nav";
import { LiquidBackground } from "@/components/LiquidBackground";

export const metadata: Metadata = {
  title: "Klassenbuch · Erinnerungen",
  description: "Euer digitales Erinnerungsbuch — Zitate, Bilder und Momente der ganzen Klasse.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Caveat:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <LiquidBackground />
        <SiteNav />
        <main className="mx-auto max-w-3xl px-5 pb-28 pt-7 lg:pb-14 lg:pt-8">{children}</main>
      </body>
    </html>
  );
}
