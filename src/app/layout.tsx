import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/Nav";

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
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Caveat:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans pb-24">
        <main className="mx-auto max-w-xl px-4 pt-5">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
