import { describe, expect, it } from "vitest";
import {
  areDesktopPreferencesEqual,
  createDesktopPreferencesDraft,
  DEFAULT_DESKTOP_PREFERENCES,
  getDesktopCount,
  MAX_DESKTOP_COUNT,
} from "./desktopPreferences";

describe("desktop preferences model", () => {
  it("keeps the current desktop visual defaults immutable", () => {
    expect(DEFAULT_DESKTOP_PREFERENCES).toEqual({
      locale: "en",
      themeId: "kde-classic",
      backgroundPreset: "kde-classic",
      showDesktopIcons: true,
      showClockDate: true,
      lcdClockLook: true,
      showSeconds: false,
      showDayOfWeek: false,
      blinkingClockDots: true,
      showClockFrame: true,
      showTasksFromAllDesktops: false,
      desktopCount: 4,
      konquerorDockOrder: "toolbar-location",
      konquerorResourceViewMode: "tree",
      konquerorResourceTreeZoom: "normal",
      konquerorResourceIconZoom: "normal",
    });
    expect(Object.isFrozen(DEFAULT_DESKTOP_PREFERENCES)).toBe(true);
  });

  it("creates independent drafts and compares every preference field", () => {
    const draft = createDesktopPreferencesDraft(DEFAULT_DESKTOP_PREFERENCES);

    expect(draft).not.toBe(DEFAULT_DESKTOP_PREFERENCES);
    expect(areDesktopPreferencesEqual(draft, DEFAULT_DESKTOP_PREFERENCES)).toBe(true);
    expect(areDesktopPreferencesEqual({ ...draft, backgroundPreset: "teal" }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, showDesktopIcons: false }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, showClockDate: false }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, lcdClockLook: false }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, showTasksFromAllDesktops: true }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, desktopCount: 5 }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, konquerorDockOrder: "location-toolbar" }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, konquerorResourceViewMode: "icons" }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, konquerorResourceTreeZoom: "large" }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
    expect(areDesktopPreferencesEqual({ ...draft, konquerorResourceIconZoom: "small" }, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
  });

  it("normalizes legacy and invalid desktop counts to the persistent default", () => {
    expect(getDesktopCount({})).toBe(4);
    expect(getDesktopCount({ desktopCount: 1 })).toBe(1);
    expect(getDesktopCount({ desktopCount: MAX_DESKTOP_COUNT })).toBe(MAX_DESKTOP_COUNT);
    expect(getDesktopCount({ desktopCount: MAX_DESKTOP_COUNT + 1 })).toBe(MAX_DESKTOP_COUNT);
    expect(getDesktopCount({ desktopCount: 0 })).toBe(4);
    expect(getDesktopCount({ desktopCount: 1.5 })).toBe(4);
  });
});
