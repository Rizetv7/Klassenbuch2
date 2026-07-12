import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./nachbilder.css";
import { SiteNav } from "@/components/Nav";
import { LiquidBackground } from "@/components/LiquidBackground";
import { PwaSetup } from "@/components/PwaSetup";
import { NotifyBanner } from "@/components/NotifyBanner";
import { ThemeOnboarding } from "@/components/ThemeMenu";
import { NewsPopup } from "@/components/NewsPopup";

export const metadata: Metadata = {
  title: "Maturaziitig · Erinnerungen",
  description: "Euer digitales Erinnerungsbuch — Zitate, Bilder und Momente der ganzen Klasse.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Maturaziitig",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // viewport-fit=cover is what makes env(safe-area-inset-*) resolve to real
  // values on notch/home-indicator iPhones and iPads — without it every
  // safe-area rule silently evaluates to 0 in standalone/PWA mode.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3d7ea" },
    { media: "(prefers-color-scheme: dark)", color: "#140d1c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script below stamps data-theme/data-mode before hydration,
    // so the server<->client attribute diff on <html> is expected
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Apply the saved design + theme + light/dark mode before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var el=document.documentElement;var g=localStorage.getItem("mz-design");if(g!=="fashion"&&g!=="nachbilder")g="aquarell";el.dataset.design=g;if(g!=="aquarell"){el.dataset.theme="standard";el.dataset.mode="light";return;}var t=localStorage.getItem("mz-theme");if(t!=="standard"&&t!=="insta")t="standard";var m=localStorage.getItem("mz-mode")==="dark"?"dark":"light";el.dataset.theme=t;el.dataset.mode=(t==="insta")?"dark":m;}catch(e){}})();',
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <PwaSetup />
        <ThemeOnboarding />
        <NewsPopup />
        <LiquidBackground />
        <SiteNav />
        <main className="site-main mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16 lg:pt-8">
          <NotifyBanner />
          {children}
        </main>
      </body>
    </html>
  );
}
