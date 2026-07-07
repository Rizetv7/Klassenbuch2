// Shared theme registry. Both the theme and the light/dark "mode" are personal
// per-device preferences (stored in localStorage) — everyone picks their own.
// The light/dark toggle currently only applies to the standard theme.

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
    tagline: "Wasserfarben, Glas & Handschrift — der Klassiker.",
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
