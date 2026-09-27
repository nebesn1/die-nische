export const desktopLocales = ["en", "zh-CN", "de"] as const;

export type DesktopLocale = (typeof desktopLocales)[number];

export const DEFAULT_DESKTOP_LOCALE: DesktopLocale = "en";

export const desktopLocaleOptions: readonly { readonly id: DesktopLocale; readonly label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
  { id: "de", label: "Deutsch" },
];

export function isDesktopLocale(value: unknown): value is DesktopLocale {
  return typeof value === "string" && (desktopLocales as readonly string[]).includes(value);
}

export function normalizeDesktopLocale(value: unknown): DesktopLocale {
  return isDesktopLocale(value) ? value : DEFAULT_DESKTOP_LOCALE;
}

const normalizeBrowserLanguageTag = (value: unknown): DesktopLocale | null => {
  if (typeof value !== "string") {
    return null;
  }

  const subtags = value.trim().toLowerCase().split("-");
  const language = subtags[0];

  if (language === "de") {
    return "de";
  }

  if (language === "en") {
    return "en";
  }

  if (language !== "zh") {
    return null;
  }

  if (subtags.length === 1) {
    return "zh-CN";
  }

  const region = subtags.slice(1).find((subtag) => subtag.length === 2 && /^[a-z]{2}$/.test(subtag));

  if (subtags.includes("hant") || region === "tw" || region === "hk" || region === "mo") {
    return null;
  }

  if (subtags.includes("hans") || region === "cn" || region === "sg") {
    return "zh-CN";
  }

  return null;
};

/** Maps the browser's ordered language preferences to the supported UI locales. */
export function detectSupportedBrowserLocale(
  languages: readonly unknown[] | null | undefined,
  fallbackLanguage?: unknown,
): DesktopLocale {
  const candidates = [...(languages ?? [])];
  const normalizedFallback = typeof fallbackLanguage === "string"
    ? fallbackLanguage.trim().toLowerCase()
    : "";

  if (normalizedFallback !== "" && !candidates.some((candidate) => (
    typeof candidate === "string" && candidate.trim().toLowerCase() === normalizedFallback
  ))) {
    candidates.push(fallbackLanguage);
  }

  for (const candidate of candidates) {
    const locale = normalizeBrowserLanguageTag(candidate);

    if (locale !== null) {
      return locale;
    }
  }

  return DEFAULT_DESKTOP_LOCALE;
}
