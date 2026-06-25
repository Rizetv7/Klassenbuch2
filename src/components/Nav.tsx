"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconUsers, IconUser } from "./Icons";

// Deterministic accent color from a name/id — within the violet/pink/blue
// scheme — for the ring around each round avatar.
const ACCENTS = ["#7E5BD9", "#8FB6EF", "#C77ACF", "#B68CF0", "#6FA8E8", "#E49ED0"];
export function deriveAccent(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function Avatar({
  name,
  url,
  size = 44,
  accent,
  ring = true,
}: {
  name: string;
  url?: string | null;
  size?: number;
  accent?: string | null;
  ring?: boolean;
}) {
  const color = accent || deriveAccent(name || "?");
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const ringStyle = ring ? { boxShadow: `0 0 0 2.5px ${color}` } : undefined;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80 font-extrabold text-ink/70"
      style={{ width: size, height: size, fontSize: size * 0.38, ...ringStyle }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

const ITEMS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/classes", label: "Klasse", Icon: IconUsers },
  { href: "/profile", label: "Profil", Icon: IconUser },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

// Renders the right nav for the viewport: a top bar on desktop, a floating
// bottom bar on phones.
export function SiteNav() {
  const path = usePathname();
  if (path === "/login" || path === "/register") return null;
  return (
    <>
      <TopNav />
      <BottomNav />
    </>
  );
}

function TopNav() {
  const isActive = useActive();
  return (
    <header className="sticky top-0 z-30 hidden lg:block">
      <div className="surface mx-auto mt-4 flex max-w-5xl items-center gap-2 rounded-full px-4 py-2">
        <Link href="/" className="display mr-2 text-xl">Klassenbuch</Link>
        <nav className="ml-auto flex items-center gap-1">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                isActive(it.href) ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="mx-auto max-w-sm px-4 pb-4">
        <div className="surface flex items-center justify-around px-3 py-2">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-4 py-1 text-[11px] font-bold transition ${
                isActive(it.href) ? "text-ink" : "text-ink/40"
              }`}
            >
              <it.Icon size={22} className={isActive(it.href) ? "scale-110 transition" : "transition"} />
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
