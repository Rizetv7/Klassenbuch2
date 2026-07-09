// Client-side appearance runtime. The DESIGN (complete experience), the THEME
// (Aquarell color variation) and the light/dark MODE are all personal
// per-device choices in localStorage, applied as data-attributes on <html>;
// globals.css and a few design-aware components do the rest. A tiny inline
// script in the root layout applies everything before first paint (no flash).

import { DESIGNS, THEMES, type DesignId, type ThemeId, isDesignId, isThemeId } from "./themes";

const DESIGN_KEY = "mz-design";
const THEME_KEY = "mz-theme";
const MODE_KEY = "mz-mode";

export type Mode = "light" | "dark";

export function storedDesign(): DesignId {
  if (typeof window === "undefined") return "aquarell";
  try {
    const value = localStorage.getItem(DESIGN_KEY);
    return isDesignId(value) ? value : "aquarell";
  } catch {
    return "aquarell";
  }
}

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

function applyAttributes(design: DesignId, theme: ThemeId, mode: Mode) {
  const el = document.documentElement;
  const designInfo = DESIGNS.find((d) => d.id === design);
  el.dataset.design = design;
  if (designInfo && !designInfo.supportsThemes) {
    // standalone designs bring their own palette; neutralize theme attributes
    el.dataset.theme = "standard";
    el.dataset.mode = "light";
    return;
  }
  const info = THEMES.find((t) => t.id === theme);
  el.dataset.theme = theme;
  el.dataset.mode = info?.alwaysDark ? "dark" : mode;
}

function applyAll() {
  applyAttributes(storedDesign(), storedTheme(), storedMode());
  window.dispatchEvent(new CustomEvent("mz-theme-change"));
}

/** Persist + apply the chosen design (complete experience). */
export function setLocalDesign(design: DesignId) {
  try {
    localStorage.setItem(DESIGN_KEY, design);
  } catch {}
  applyAll();
}

/** Persist + apply the device light/dark preference (Aquarell only). */
export function setMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
  applyAll();
}

/** Persist + apply the Aquarell theme variation. */
export function setLocalTheme(theme: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  applyAll();
}
