"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Deterministic warm accent color from a name/id — gives every person a
// consistent colored ring around their round "sticker" avatar.
const ACCENTS = ["#F6B2A2", "#BFE0EF", "#C3E0C6", "#FFD479", "#D9C7F0", "#F4A38F", "#8ECfE6"];
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
  const ringStyle = ring ? { boxShadow: `0 0 0 3px ${color}` } : undefined;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-paper font-extrabold text-ink/70"
      style={{ width: size, height: size, fontSize: size * 0.38, ...ringStyle }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/classes", label: "Klasse", icon: "👥" },
  { href: "/upload", label: "", icon: "＋", center: true },
  { href: "/projects", label: "Projekte", icon: "🎨" },
  { href: "/profile", label: "Profil", icon: "🙂" },
];

export function BottomNav() {
  const path = usePathname();
  // hide nav on auth screens
  if (path === "/login" || path === "/register") return null;

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30">
      <div className="mx-auto max-w-xl px-4 pb-4">
        <div className="surface shadow-soft flex items-center justify-between px-3 py-2">
          {ITEMS.map((it) =>
            it.center ? (
              <Link
                key={it.href}
                href={it.href}
                className="-mt-7 grid place-items-center w-14 h-14 rounded-full bg-coral text-ink text-3xl font-light shadow-sticker active:scale-95 transition"
                aria-label="Hochladen"
              >
                {it.icon}
              </Link>
            ) : (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl text-[11px] font-bold transition ${
                  isActive(it.href) ? "text-ink" : "text-muted"
                }`}
              >
                <span className={`text-lg ${isActive(it.href) ? "scale-110" : ""} transition`}>
                  {it.icon}
                </span>
                {it.label}
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
