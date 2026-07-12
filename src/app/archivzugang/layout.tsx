import type { Metadata, Viewport } from "next";
import "../admin.css";

export const metadata: Metadata = {
  title: "Maturaziitig Archiv",
  robots: { index: false, follow: false, nocache: true },
  // Its own manifest -> "Zum Home-Bildschirm" installs a dedicated Admin app,
  // separate from the main Maturaziitig app.
  manifest: "/admin-manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "MZ Archiv",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#e845ad",
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <div className="admin-workspace">{children}</div>
    </div>
  );
}
