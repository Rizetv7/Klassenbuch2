// Registry for the two levels of personalization:
//
// DESIGNS are complete, standalone experiences — they may change layout,
// navigation, typography and interactions (Aquarell, Couture/High-Fashion;
// the Amina mode is its own guarded design living under /amina).
//
// THEMES are light variations (colors, mood, small UI details) and apply
// ONLY to the Aquarell design: light/dark mode and the pitch-black
// "Nachtschwarz" Insta look.
//
// Both are personal per-device choices stored in localStorage.

export const DESIGN_IDS = ["aquarell", "fashion"] as const;
export type DesignId = (typeof DESIGN_IDS)[number];

export type DesignInfo = {
  id: DesignId;
  name: string;
  tagline: string;
  /** designs without theme support ignore the theme/mode pickers */
  supportsThemes: boolean;
};

export const DESIGNS: DesignInfo[] = [
  {
    id: "aquarell",
    name: "Aquarell",
    tagline: "Wasserfarben, Glas & Handschrift — der Hauptmodus.",
    supportsThemes: true,
  },
  {
    id: "fashion",
    name: "Couture",
    tagline: "High-Fashion-Magazin: Ivory, Serifen, rote Akzente.",
    supportsThemes: false,
  },
];

export function isDesignId(value: unknown): value is DesignId {
  return typeof value === "string" && (DESIGN_IDS as readonly string[]).includes(value);
}

export const THEME_IDS = ["standard", "insta"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeInfo = {
  id: ThemeId;
  name: string;
  tagline: string;
  /** themes that are inherently dark ignore the light/dark toggle */
  alwaysDark: boolean;
};

export const THEMES: ThemeInfo[] = [
  {
    id: "standard",
    name: "Aquarell",
    tagline: "Die klassischen Wasserfarben, hell oder dunkel.",
    alwaysDark: false,
  },
  {
    id: "insta",
    name: "Nachtschwarz",
    tagline: "Tiefschwarzer Insta-Look mit feinen Linien.",
    alwaysDark: true,
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
