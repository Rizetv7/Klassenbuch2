"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./Icons";
import { THEMES, type ThemeId } from "@/lib/themes";
import { setLocalTheme, setMode, storedMode, storedTheme, type Mode } from "@/lib/theme";

function IconPalette({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1-2-2c0-1.1.9-2 2-2h6a3 3 0 0 0 3-3c0-3.5-4-6-9-6z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSun({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
    </svg>
  );
}

function IconMoon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </svg>
  );
}

// Hand-built mini mockups. Deliberately theme-INDEPENDENT (literal colors),
// so each card always previews its own look, whatever is currently active.
function PreviewStandard({ dark = false }: { dark?: boolean }) {
  const bg = dark
    ? "linear-gradient(160deg,#162436 0%,#1e1629 34%,#3a1c33 62%,#5c184a 100%)"
    : "linear-gradient(160deg,#cfeaf9 0%,#fdf6f7 34%,#f7c4e3 62%,#ee4fb3 100%)";
  const glass = dark ? "rgba(134,129,172,0.26)" : "rgba(255,255,255,0.45)";
  const line = dark ? "rgba(134,129,172,0.5)" : "rgba(255,255,255,0.7)";
  const bar = dark ? "rgba(244,241,250,0.75)" : "rgba(9,7,12,0.55)";
  return (
    <div className="flex h-full w-full flex-col justify-end gap-1.5 p-3" style={{ background: bg }}>
      <div className="rounded-xl border p-2" style={{ background: glass, borderColor: line }}>
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-full" style={{ background: dark ? "#f260ba" : "#ee4fb3" }} />
          <span className="h-1.5 w-10 rounded-full" style={{ background: bar }} />
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full" style={{ background: bar, opacity: 0.55 }} />
        <div className="mt-1 h-1.5 w-2/3 rounded-full" style={{ background: bar, opacity: 0.35 }} />
      </div>
      <div className="mx-auto flex w-4/5 justify-around rounded-full border px-2 py-1" style={{ background: glass, borderColor: line }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: bar }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: bar, opacity: 0.5 }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: bar, opacity: 0.5 }} />
      </div>
    </div>
  );
}

function PreviewInsta() {
  return (
    <div className="flex h-full w-full flex-col gap-2 bg-black p-3">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-5 w-5 rounded-full"
            style={{ background: "#1c1c1c", boxShadow: "0 0 0 1.6px #000, 0 0 0 3px #dd2a7b" }}
          />
        ))}
        <span className="ml-auto h-2 w-2 rounded-full" style={{ background: "#ff3040" }} />
      </div>
      <div className="flex-1 rounded-lg border p-2" style={{ borderColor: "#2e2e2e", background: "#0b0b0b" }}>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: "#333" }} />
          <span className="h-1.5 w-10 rounded-full" style={{ background: "rgba(245,245,245,0.85)" }} />
        </div>
        <div className="mt-1.5 h-6 rounded-md" style={{ background: "#1c1c1c" }} />
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#ff3040" }} />
          <span className="h-1.5 w-8 rounded-full" style={{ background: "rgba(245,245,245,0.4)" }} />
        </div>
      </div>
    </div>
  );
}

// A personal, per-device appearance picker: everyone chooses their own theme
// and light/dark mode — nothing is shared with the class.
export function ThemeMenu({ label = "Design", className = "btn-soft text-sm" }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setModeState] = useState<Mode>("light");
  const [active, setActive] = useState<ThemeId>("standard");

  useEffect(() => {
    if (!open) return;
    setModeState(storedMode());
    setActive(storedTheme());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function pickMode(next: Mode) {
    setModeState(next);
    setMode(next);
  }

  function pickTheme(next: ThemeId) {
    if (next === active) return;
    setActive(next);
    setLocalTheme(next); // applies instantly across the whole app
  }

  const activeInfo = THEMES.find((t) => t.id === active);
  const modeLocked = !!activeInfo?.alwaysDark;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <IconPalette size={17} />
        {label}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
            <div
              className="theme-sheet relative w-full border border-white/40 sm:max-w-lg"
              style={{
                background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.4), rgb(var(--c-surface) / 0.22)), var(--page-bg)",
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
              }}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" />
              <div className="flex items-start justify-between px-5 pt-4 sm:pt-5">
                <div>
                  <p className="section-label">Erscheinungsbild</p>
                  <h2 className="display text-3xl leading-none">Design</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Schliessen"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/30 text-ink/70 transition hover:bg-white/50 hover:rotate-90"
                >
                  <IconClose size={18} />
                </button>
              </div>

              <div className="space-y-5 px-5 pb-2 pt-4">
                {/* light / dark for the standard look */}
                <div>
                  <p className="mb-2 text-xs font-black uppercase text-ink/50">Modus · für dich</p>
                  <div className="grid grid-cols-2 gap-1.5 rounded-full border border-white/45 bg-white/20 p-1.5">
                    {(["light", "dark"] as const).map((m) => {
                      const selected = !modeLocked && mode === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={modeLocked}
                          onClick={() => pickMode(m)}
                          className={`flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all duration-150 active:scale-95 disabled:opacity-45 ${
                            selected ? "animate-pop bg-ink text-oncolor shadow-soft" : "text-ink/60 hover:text-ink"
                          }`}
                        >
                          {m === "light" ? <IconSun /> : <IconMoon />}
                          {m === "light" ? "Hell" : "Dunkel"}
                        </button>
                      );
                    })}
                  </div>
                  {modeLocked && (
                    <p className="mt-1.5 pl-1 text-[11px] font-bold text-ink/45">„{activeInfo?.name}“ ist immer dunkel.</p>
                  )}
                </div>

                {/* personal theme */}
                <div>
                  <p className="mb-2 text-xs font-black uppercase text-ink/50">Design · für dich</p>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map((t) => {
                      const selected = active === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => pickTheme(t.id)}
                          className={`group relative overflow-hidden rounded-[22px] border-2 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] ${
                            selected ? "border-hotpink shadow-soft" : "border-white/40 hover:border-white/70"
                          }`}
                        >
                          <div className="h-28 overflow-hidden">
                            {t.id === "insta" ? <PreviewInsta /> : <PreviewStandard />}
                          </div>
                          <div className="border-t border-white/30 bg-white/20 px-3 py-2">
                            <p className="text-sm font-black leading-tight">{t.name}</p>
                            <p className="mt-0.5 text-[10px] font-bold leading-tight text-ink/50">{t.tagline}</p>
                          </div>
                          {selected && (
                            <span className="absolute right-2 top-2 grid h-6 w-6 animate-pop-in place-items-center rounded-full bg-hotpink text-[13px] font-black text-snow shadow-soft">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
