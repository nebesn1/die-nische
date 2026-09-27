export const themeIds = ["kde-classic", "redmond"] as const;

export type ThemeId = (typeof themeIds)[number];

export type ThemeDefinition = {
  readonly id: ThemeId;
  readonly label: string;
};

export const DEFAULT_THEME_ID: ThemeId = "kde-classic";

export const themeCatalog: readonly ThemeDefinition[] = [
  { id: "kde-classic", label: "KDE_Classic" },
  { id: "redmond", label: "Redmond" },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (themeIds as readonly string[]).includes(value);
}
