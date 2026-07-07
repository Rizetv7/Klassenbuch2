// Client-side theme runtime. The theme (per class, moderator-picked) and the
// light/dark mode (per device) live in localStorage and are applied as
// data-attributes on <html>; globals.css does the rest. A tiny inline script
// in the root layout applies both before first paint (no flash).

import { THEMES, type ThemeId, isThemeId } from "./themes";

const THEME_KEY = "mz-theme";
const MODE_KEY = "mz-mode";

export type Mode = "light" | "dark";

export function storedTheme(): ThemeId {
  if (typeof window === "undefined") return "standard";
  try {
    const value = localStorage.getItem(THEME_KEY);
    return isThemeId(value) ? value : "standard";
  } catch {
    return "standard";
  }
}

export function storedMode(): Mode {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyAttributes(theme: ThemeId, mode: Mode) {
  const el = document.documentElement;
  const info = THEMES.find((t) => t.id === theme);
  el.dataset.theme = theme;
  el.dataset.mode = info?.alwaysDark ? "dark" : mode;
}

/** Persist + apply the device light/dark preference. */
export function setMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
  applyAttributes(storedTheme(), mode);
  window.dispatchEvent(new CustomEvent("mz-theme-change"));
}

/** Persist + apply the theme this person picked, on this device. */
export function setLocalTheme(theme: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  applyAttributes(theme, storedMode());
  window.dispatchEvent(new CustomEvent("mz-theme-change"));
}
