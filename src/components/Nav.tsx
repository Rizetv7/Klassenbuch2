"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconHome, IconUsers, IconUser, IconPoll, IconImage, IconPlus } from "./Icons";
import { swrJson } from "@/lib/swr";
import { QuickPostDialog } from "./QuickPostDialog";

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
      className="app-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/70 font-black text-ink/75"
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
  { href: "/bilder", label: "Bilder", Icon: IconImage },
  { href: "/polls", label: "Umfragen", Icon: IconPoll },
  { href: "/profile", label: "Profil", Icon: IconUser },
];

// 5 Punkte, das Plus sitzt exakt in der Mitte — das Profil lebt oben
// als Avatar-Shortcut (MobileProfileShortcut), nicht in der Bar.
const MOBILE_ITEMS = [
  { kind: "link" as const, href: "/", label: "Home", Icon: IconHome },
  { kind: "link" as const, href: "/classes", label: "Klasse", Icon: IconUsers },
  { kind: "post" as const, label: "Posten", Icon: IconPlus },
  { kind: "link" as const, href: "/bilder", label: "Bilder", Icon: IconImage },
  { kind: "link" as const, href: "/polls", label: "Umfragen", Icon: IconPoll },
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
  const [postOpen, setPostOpen] = useState(false);
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
      {/* Every standalone design owns its chrome; CSS shows exactly one. */}
      <TopNav me={me} onOpenPost={() => setPostOpen(true)} />
      <BottomNav onOpenPost={() => setPostOpen(true)} />
      <div className="fx-only">
        <FashionMasthead onOpenPost={() => setPostOpen(true)} />
        <FashionBottomNav onOpenPost={() => setPostOpen(true)} />
      </div>
      <div className="nb-app-only">
        <NachbilderMasthead me={me} onOpenPost={() => setPostOpen(true)} />
        <NachbilderBottomNav onOpenPost={() => setPostOpen(true)} />
      </div>
      {me ? <MobileProfileShortcut me={me} /> : null}
      {postOpen ? <QuickPostDialog onClose={() => setPostOpen(false)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------
// NACHBILDER navigation: a thin archive register instead of a glass dock.
// The immersive homepage carries its own controls and hides this chrome.
// ---------------------------------------------------------------------
function NachbilderMasthead({ me, onOpenPost }: { me: NavUser | null; onOpenPost: () => void }) {
  const isActive = useActive();
  return (
    <header className="nb-site-header">
      <div className="nb-site-header-inner">
        <Link href="/" className="nb-site-brand">
          <span>Nachbilder</span>
          <small>Maturaziitig · Archiv {new Date().getFullYear()}</small>
        </Link>
        <nav className="nb-site-links" aria-label="Hauptnavigation">
          {ITEMS.map((item, index) => {
            const profile = item.href === "/profile" && me;
            return (
              <Link key={item.href} href={item.href} className={isActive(item.href) ? "is-active" : ""}>
                <span className="nb-site-link-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{item.label}</span>
                {profile ? <Avatar name={me.name} url={me.avatarUrl} accent={me.accentColor} size={27} ring={false} /> : null}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={onOpenPost} className="nb-site-create" aria-label="Neuen Eintrag posten">
          <IconPlus size={18} />
          <span>Neue Spur</span>
        </button>
        {me ? (
          <Link href="/profile" className="nb-site-mobile-profile" aria-label={`Zum Profil von ${me.name}`}>
            <Avatar name={me.name} url={me.avatarUrl} accent={me.accentColor} size={32} ring={false} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function NachbilderBottomNav({ onOpenPost }: { onOpenPost: () => void }) {
  const isActive = useActive();
  return (
    <nav className="nb-site-bottom" aria-label="Mobile Navigation">
      {MOBILE_ITEMS.map((item, index) => {
        if (item.kind === "post") {
          return (
            <button key="post" type="button" onClick={onOpenPost} className="nb-site-bottom-create" aria-label="Neuen Eintrag posten">
              <IconPlus size={22} />
            </button>
          );
        }
        return (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? "is-active" : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <item.Icon size={18} />
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------
// COUTURE navigation: a magazine masthead on top (all viewports) and a
// hairline text bar at the bottom on phones.
// ---------------------------------------------------------------------
function FashionMasthead({ onOpenPost }: { onOpenPost: () => void }) {
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
          <button type="button" onClick={onOpenPost} className="fx-link text-ink/60 hover:text-ink">Posten</button>
        </nav>
        <div className="fx-rule-double" style={{ transform: "scaleY(-1)" }} />
      </div>
    </header>
  );
}

function FashionBottomNav({ onOpenPost }: { onOpenPost: () => void }) {
  const isActive = useActive();
  return (
    <nav className="site-bottom-nav fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="border-t border-ink/85 bg-[#f3efe6] pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2.5 pb-1.5">
          {MOBILE_ITEMS.map((it) => {
            if (it.kind === "post") {
              return (
                <button key={it.kind} type="button" onClick={onOpenPost} className="fx-nav-create" aria-label="Neuen Eintrag posten" title="Neuen Eintrag posten">
                  <IconPlus size={23} />
                </button>
              );
            }
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-1 px-2 transition active:scale-95 ${
                  isActive(it.href) ? "text-ink" : "text-ink/50"
                }`}
              >
                <it.Icon size={19} className="transition" />
                <span className={`fx-link !p-0 text-[9px] ${isActive(it.href) ? "is-active" : ""}`}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function TopNav({ me, onOpenPost }: { me: NavUser | null; onOpenPost: () => void }) {
  const isActive = useActive();
  return (
    <header className="aq-only sticky top-0 z-30 hidden lg:block">
      <div className="surface site-top-nav-surface mx-auto mt-4 flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link href="/" className="display mr-2 text-2xl leading-none">Maturaziitig</Link>
        <nav className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onOpenPost} className="btn-accent !px-3.5 !py-2 text-sm" title="Neuen Eintrag posten">
            <IconPlus size={17} />
            Posten
          </button>
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

function BottomNav({ onOpenPost }: { onOpenPost: () => void }) {
  const isActive = useActive();
  return (
    <nav className="aq-only site-bottom-nav fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="site-bottom-inner mx-auto max-w-md">
        <div className="dock site-bottom-dock flex items-center justify-around px-2.5 py-2">
          {MOBILE_ITEMS.map((it) => {
            if (it.kind === "post") {
              return (
                <button
                  key={it.kind}
                  type="button"
                  onClick={onOpenPost}
                  className="nav-compose-button"
                  aria-label="Neuen Eintrag posten"
                  title="Neuen Eintrag posten"
                >
                  <IconPlus size={25} />
                </button>
              );
            }
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] font-black transition-all duration-150 active:scale-90 sm:px-3.5 sm:text-[11px] ${
                  active
                    ? "nav-item-active bg-ink text-oncolor shadow-soft"
                    : "text-ink/65 hover:text-ink"
                }`}
                style={active ? { animation: "nav-pop 340ms cubic-bezier(0.24, 1.4, 0.36, 1) both" } : undefined}
              >
                <it.Icon size={21} className="transition" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function MobileProfileShortcut({ me }: { me: NavUser }) {
  return (
    <Link
      href="/profile"
      className="mobile-profile-shortcut lg:hidden"
      aria-label={`Zum Profil von ${me.name}`}
      title="Mein Profil"
    >
      <Avatar name={me.name} url={me.avatarUrl} accent={me.accentColor} size={34} ring={false} />
    </Link>
  );
}
