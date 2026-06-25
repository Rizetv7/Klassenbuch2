import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/Nav";
import { Decorations } from "@/components/Decorations";

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
      <body className="font-sans pb-28">
        <Decorations />
        <main className="mx-auto max-w-3xl px-5 pt-7 sm:pt-9">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
