"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconHome, IconUsers, IconUser } from "./Icons";

const ACCENTS = ["#ff2fbf", "#ec35d6", "#28d9f2", "#72eadf", "#b9a7ff", "#ffc4a3"];
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
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/70 font-black text-ink/75"
      style={{ width: size, height: size, fontSize: size * 0.38, ...ringStyle }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} decoding="async" className="h-full w-full object-cover" />
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

type NavUser = {
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
};

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

// Renders the right nav for the viewport: a top bar on desktop, a floating
// bottom bar on phones.
export function SiteNav() {
  const path = usePathname();
  const [me, setMe] = useState<NavUser | null>(null);

  useEffect(() => {
    if (path === "/login" || path === "/register") return;
    let active = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setMe(d?.user ?? null);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (path === "/login" || path === "/register") return null;
  return (
    <>
      <TopNav me={me} />
      <BottomNav me={me} />
    </>
  );
}

function TopNav({ me }: { me: NavUser | null }) {
  const isActive = useActive();
  return (
    <header className="sticky top-0 z-30 hidden lg:block">
      <div className="surface mx-auto mt-4 flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link href="/" className="display mr-2 text-2xl leading-none">Maturaziitig</Link>
        <nav className="ml-auto flex items-center gap-1">
          {ITEMS.map((it) => {
            const profile = it.href === "/profile" && me;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                  isActive(it.href) ? "bg-ink text-white shadow-soft" : "text-ink/70 hover:bg-white/40 hover:text-ink"
                }`}
              >
                <span>{it.label}</span>
                {profile && (
                  <Avatar
                    name={me.name}
                    url={me.avatarUrl}
                    accent={me.accentColor}
                    size={26}
                    ring={false}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function BottomNav({ me }: { me: NavUser | null }) {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="mx-auto max-w-sm px-4 pb-4">
        <div className="surface flex items-center justify-around px-3 py-2">
          {ITEMS.map((it) => {
            const profile = it.href === "/profile" && me;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-[11px] font-black transition ${
                  isActive(it.href) ? "bg-ink text-white shadow-soft" : "text-ink/50"
                }`}
              >
                {profile ? (
                  <Avatar name={me.name} url={me.avatarUrl} accent={me.accentColor} size={22} ring={false} />
                ) : (
                  <it.Icon size={21} className="transition" />
                )}
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
