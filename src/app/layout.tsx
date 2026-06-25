import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/Nav";
import { LiquidBackground } from "@/components/LiquidBackground";

export const metadata: Metadata = {
  title: "Maturaziitig · Erinnerungen",
  description: "Euer digitales Erinnerungsbuch — Zitate, Bilder und Momente der ganzen Klasse.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Fraunces:opsz,wght@9..144,700;9..144,800;9..144,900&family=Inter:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <LiquidBackground />
        <SiteNav />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16 lg:pt-8">{children}</main>
      </body>
    </html>
  );
}
