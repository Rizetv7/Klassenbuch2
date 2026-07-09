"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconHome, IconUsers, IconUser, IconPoll } from "./Icons";
import { swrJson } from "@/lib/swr";

const ACCENTS = ["#ee4fb3", "#f584c3", "#7ec4ec", "#8fdcc9", "#b9a7ff", "#f4b8d2"];
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
  // themes may force a uniform ring (e.g. the Insta story-ring pink)
  const ringStyle = ring ? { boxShadow: `0 0 0 2.5px var(--avatar-ring, ${color})` } : undefined;

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
  { href: "/polls", label: "Umfragen", Icon: IconPoll },
  { href: "/profile", label: "Profil", Icon: IconUser },
];

type NavUser = {
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
  aminaMode?: boolean;
};

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

// Renders the right nav for the viewport: a top bar on desktop, a floating
// bottom bar on phones.
export function SiteNav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<NavUser | null>(null);
  const isInternal = path.startsWith("/archivzugang");
  const isAminaMode = path.startsWith("/amina");

  useEffect(() => {
    if (path === "/login" || path === "/register" || isInternal || isAminaMode) return;
    // cache-first: the avatar shows instantly, the check refreshes in background
    return swrJson<{ user?: NavUser }>("/api/auth/me", (d) => {
      const user = d?.user ?? null;
      setMe(user);
      if (user?.aminaMode) router.replace("/amina");
    });
  }, [isAminaMode, isInternal, path, router]);

  if (path === "/login" || path === "/register" || isInternal || isAminaMode) return null;
  return (
    <>
      {/* Aquarell chrome and the Couture masthead are both rendered;
          CSS (.aq-only / .fx-only) shows exactly one — instant, flash-free */}
      <TopNav me={me} />
      <BottomNav me={me} />
      <div className="fx-only">
        <FashionMasthead />
        <FashionBottomNav me={me} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// COUTURE navigation: a magazine masthead on top (all viewports) and a
// hairline text bar at the bottom on phones.
// ---------------------------------------------------------------------
function FashionMasthead() {
  const isActive = useActive();
  const today = new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <header className="bg-transparent">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="fx-rule-double flex items-center justify-between pt-3 text-ink/60">
          <p className="fx-label hidden pt-2 sm:block">Digitales Jahrbuch</p>
          <p className="fx-label fx-gold pt-2">{today}</p>
          <p className="fx-label hidden pt-2 sm:block">Ausgabe N° {new Date().getFullYear()}</p>
        </div>
        <Link href="/" className="block py-2 text-center sm:py-3">
          <span className="display block text-5xl leading-none tracking-tight sm:text-7xl">Maturaziitig</span>
          <span className="fx-label mt-1.5 block text-ink/45">
            <span className="fx-gold">✦</span>&nbsp;&nbsp;Das Magazin deiner Klasse&nbsp;&nbsp;<span className="fx-gold">✦</span>
          </span>
        </Link>
        <nav className="fx-rule hidden items-center justify-center gap-8 py-2.5 lg:flex">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className={`fx-link ${isActive(it.href) ? "is-active text-ink" : "text-ink/60 hover:text-ink"}`}>
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="fx-rule-double" style={{ transform: "scaleY(-1)" }} />
      </div>
    </header>
  );
}

function FashionBottomNav({ me }: { me: NavUser | null }) {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="border-t border-ink/85 bg-[#f3efe6] pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2.5 pb-1.5">
          {ITEMS.map((it) => {
            const profile = it.href === "/profile" && me;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-1 px-2 transition active:scale-95 ${
                  isActive(it.href) ? "text-ink" : "text-ink/50"
                }`}
              >
                {profile ? (
                  <Avatar name={me.name} url={me.avatarUrl} accent={me.accentColor} size={20} ring={false} />
                ) : (
                  <it.Icon size={19} className="transition" />
                )}
                <span className={`fx-link !p-0 text-[9px] ${isActive(it.href) ? "is-active" : ""}`}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function TopNav({ me }: { me: NavUser | null }) {
  const isActive = useActive();
  return (
    <header className="aq-only sticky top-0 z-30 hidden lg:block">
      <div className="surface mx-auto mt-4 flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link href="/" className="display mr-2 text-2xl leading-none">Maturaziitig</Link>
        <nav className="ml-auto flex items-center gap-1">
          {ITEMS.map((it) => {
            const profile = it.href === "/profile" && me;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all duration-150 active:scale-95 ${
                  isActive(it.href)
                    ? "nav-item-active bg-ink text-oncolor shadow-soft"
                    : "text-ink/70 hover:bg-white/40 hover:text-ink"
                }`}
                style={isActive(it.href) ? { animation: "nav-pop 340ms cubic-bezier(0.24, 1.4, 0.36, 1) both" } : undefined}
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
    <nav className="aq-only fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="mx-auto max-w-sm px-4 pb-4">
        <div className="dock flex items-center justify-around px-2.5 py-2">
          {ITEMS.map((it) => {
            const profile = it.href === "/profile" && me;
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-[11px] font-black transition-all duration-150 active:scale-90 ${
                  active
                    ? "nav-item-active bg-ink text-oncolor shadow-soft"
                    : "text-ink/65 hover:text-ink"
                }`}
                style={active ? { animation: "nav-pop 340ms cubic-bezier(0.24, 1.4, 0.36, 1) both" } : undefined}
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
