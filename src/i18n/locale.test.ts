import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_LOCALE,
  detectSupportedBrowserLocale,
  isDesktopLocale,
  normalizeDesktopLocale,
} from "./locale";

describe("desktop locale model", () => {
  it("supports the three built-in locales and defaults to English", () => {
    expect(DEFAULT_DESKTOP_LOCALE).toBe("en");
    expect(["en", "zh-CN", "de"].every(isDesktopLocale)).toBe(true);
    expect(normalizeDesktopLocale(undefined)).toBe("en");
  });

  it.each([null, "fr", "zh", 42])("falls back invalid values to English: %j", (value) => {
    expect(normalizeDesktopLocale(value)).toBe("en");
  });

  it.each([
    [["de-DE"], undefined, "de"],
    [["de"], undefined, "de"],
    [["de-AT"], undefined, "de"],
    [["de-CH"], undefined, "de"],
    [["en-US"], undefined, "en"],
    [["en"], undefined, "en"],
    [["en-GB"], undefined, "en"],
    [["en-AU"], undefined, "en"],
    [["zh-CN"], undefined, "zh-CN"],
    [["zh-SG"], undefined, "zh-CN"],
    [["zh"], undefined, "zh-CN"],
    [["ZH"], undefined, "zh-CN"],
    [["zh", "de-DE"], undefined, "zh-CN"],
    [["zh-Hans"], undefined, "zh-CN"],
    [["zh-Hans-CN"], undefined, "zh-CN"],
    [["zh-Hans-SG"], undefined, "zh-CN"],
    [["zh-TW"], undefined, "en"],
    [["zh-MO"], undefined, "en"],
    [["zh-TW", "zh"], undefined, "zh-CN"],
    [["zh-Hant"], undefined, "en"],
    [["zh-Hant", "de-DE"], undefined, "de"],
    [["zh-Hant-TW"], undefined, "en"],
    [["zh-Hant-HK"], undefined, "en"],
    [["fr", "de"], undefined, "de"],
    [["zh-HK", "en-US"], undefined, "en"],
    [["fr", "nl"], undefined, "en"],
    [["fr-FR"], "de-DE", "de"],
    [["fr-FR"], "zh-CN", "zh-CN"],
    [["de-DE"], "zh-CN", "de"],
    [["zh-TW"], "de-DE", "de"],
    [[], "de-DE", "de"],
    [[], "zh-CN", "zh-CN"],
  ] as const)("maps ordered browser languages %j with fallback %j to %s", (languages, fallback, expected) => {
    expect(detectSupportedBrowserLocale(languages, fallback)).toBe(expected);
  });
});
