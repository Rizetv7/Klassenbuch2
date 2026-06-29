import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Internes Archiv",
  robots: { index: false, follow: false, nocache: true },
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
