// Shared theme registry (server + client). The theme is stored per class and
// chosen by moderators; "mode" (light/dark) is a per-device preference that
// currently only applies to the standard theme.

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
