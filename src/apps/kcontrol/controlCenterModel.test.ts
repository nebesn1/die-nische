import { describe, expect, it } from "vitest";
import { DEFAULT_DESKTOP_PREFERENCES } from "../../preferences/desktopPreferences";
import {
  controlCenterTree,
  createKControlDraft,
  getKControlWindowTitle,
  getVisibleControlCenterTreeRows,
  initialControlCenterExpandedCategories,
  isKControlDraftDirty,
  parseKControlDesktopCountDraft,
  setKControlBackground,
  setKControlClockDate,
  setKControlDesktopCount,
  setKControlDesktopIcons,
  setKControlShowTasksFromAllDesktops,
  setKControlTheme,
  shouldConfirmKControlClose,
} from "./controlCenterModel";

describe("KControl draft model", () => {
  it("defines the small hierarchical Control Center index and exact module titles", () => {
    expect(controlCenterTree).toEqual([
      {
        type: "category",
        id: "appearance-themes",
        label: "Appearance & Themes",
        children: [
          { type: "leaf", id: "background", label: "Background", page: "background" },
          { type: "leaf", id: "theme-manager", label: "Theme Manager", page: "theme-manager" },
        ],
      },
      {
        type: "category",
        id: "desktop",
        label: "Desktop",
        children: [
          { type: "leaf", id: "behavior", label: "Behavior", page: "icons" },
          { type: "leaf", id: "multiple-desktops", label: "Multiple Desktops", page: "multiple-desktops" },
        ],
      },
      {
        type: "category",
        id: "regional-accessibility",
        label: "Regional & Accessibility",
        children: [
          { type: "leaf", id: "country-region-language", label: "Country/Region & Language", page: "language" },
        ],
      },
    ]);
    expect(initialControlCenterExpandedCategories).toEqual([]);
    const allCategoryIds = controlCenterTree.map((category) => category.id);
    expect(getVisibleControlCenterTreeRows(allCategoryIds).map((row) => row.label)).toEqual([
      "Appearance & Themes",
      "Background",
      "Theme Manager",
      "Desktop",
      "Behavior",
      "Multiple Desktops",
      "Regional & Accessibility",
      "Country/Region & Language",
    ]);
    expect(getVisibleControlCenterTreeRows(allCategoryIds).map((row) => (
      row.type === "category" ? `${row.label}:category` : `${row.label}:${row.isLastChild ? "elbow" : "tee"}`
    ))).toEqual([
      "Appearance & Themes:category",
      "Background:tee",
      "Theme Manager:elbow",
      "Desktop:category",
      "Behavior:tee",
      "Multiple Desktops:elbow",
      "Regional & Accessibility:category",
      "Country/Region & Language:elbow",
    ]);
    expect(getKControlWindowTitle(null)).toBe("Control Center");
    expect(getKControlWindowTitle("background")).toBe("Background - Control Center");
    expect(getKControlWindowTitle("theme-manager")).toBe("Theme Manager - Control Center");
    expect(getKControlWindowTitle("icons")).toBe("Behavior - Control Center");
    expect(getKControlWindowTitle("multiple-desktops")).toBe("Multiple Desktops - Control Center");
    expect(getKControlWindowTitle("language")).toBe("Country/Region & Language - Control Center");
  });

  it("keeps edits local until callers apply the complete draft", () => {
    const initial = createKControlDraft(DEFAULT_DESKTOP_PREFERENCES);
    const changed = setKControlShowTasksFromAllDesktops(
      setKControlClockDate(setKControlDesktopIcons(setKControlBackground(initial, "teal"), false), false),
      true,
    );

    expect(initial).toEqual(DEFAULT_DESKTOP_PREFERENCES);
    expect(changed).toEqual({
      locale: "en",
      backgroundPreset: "teal",
      themeId: "kde-classic",
      showDesktopIcons: false,
      showClockDate: false,
      lcdClockLook: true,
      showSeconds: false,
      showDayOfWeek: false,
      blinkingClockDots: true,
      showClockFrame: true,
      showTasksFromAllDesktops: true,
      desktopCount: 4,
      konquerorDockOrder: "toolbar-location",
      konquerorResourceViewMode: "tree",
      konquerorResourceTreeZoom: "normal",
      konquerorResourceIconZoom: "normal",
    });
    expect(isKControlDraftDirty(changed, DEFAULT_DESKTOP_PREFERENCES)).toBe(true);
    expect(isKControlDraftDirty(DEFAULT_DESKTOP_PREFERENCES, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
  });

  it("keeps a valid desktop count local to the draft and rejects invalid values", () => {
    const draft = createKControlDraft(DEFAULT_DESKTOP_PREFERENCES);

    expect(setKControlDesktopCount(draft, 2)).toEqual({ ...draft, desktopCount: 2 });
    expect(setKControlDesktopCount(draft, 20)).toEqual({ ...draft, desktopCount: 20 });
    expect(setKControlDesktopCount(draft, 21)).toBe(draft);
    expect(setKControlDesktopCount(draft, 0)).toBe(draft);
    expect(setKControlDesktopCount(draft, 1.5)).toBe(draft);
  });

  it("keeps theme selection in the draft until the caller applies it", () => {
    const draft = createKControlDraft(DEFAULT_DESKTOP_PREFERENCES);
    const redmond = setKControlTheme(draft, "redmond");

    expect(draft.themeId).toBe("kde-classic");
    expect(redmond.themeId).toBe("redmond");
    expect(isKControlDraftDirty(redmond, DEFAULT_DESKTOP_PREFERENCES)).toBe(true);
  });

  it("parses an editable desktop-count draft without treating empty text as zero", () => {
    expect(parseKControlDesktopCountDraft("")).toBeNull();
    expect(parseKControlDesktopCountDraft("0")).toBeNull();
    expect(parseKControlDesktopCountDraft("21")).toBeNull();
    expect(parseKControlDesktopCountDraft("1.5")).toBeNull();
    expect(parseKControlDesktopCountDraft("1")).toBe(1);
    expect(parseKControlDesktopCountDraft("20")).toBe(20);
    expect(parseKControlDesktopCountDraft("12")).toBe(12);
  });

  it("returns clean after reverting a draft and uses the same dirty rule for close confirmation", () => {
    const changed = setKControlBackground(createKControlDraft(DEFAULT_DESKTOP_PREFERENCES), "slate");

    expect(shouldConfirmKControlClose(changed, DEFAULT_DESKTOP_PREFERENCES)).toBe(true);
    expect(shouldConfirmKControlClose(DEFAULT_DESKTOP_PREFERENCES, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);
  });

  it("supports independent false and true transitions for both visibility preferences", () => {
    const iconsHidden = setKControlDesktopIcons(DEFAULT_DESKTOP_PREFERENCES, false);
    const dateHidden = setKControlClockDate(iconsHidden, false);
    const restored = setKControlShowTasksFromAllDesktops(setKControlClockDate(setKControlDesktopIcons(dateHidden, true), true), false);

    expect(dateHidden).toEqual({ ...DEFAULT_DESKTOP_PREFERENCES, showDesktopIcons: false, showClockDate: false });
    expect(restored).toEqual(DEFAULT_DESKTOP_PREFERENCES);
    expect(isKControlDraftDirty(restored, DEFAULT_DESKTOP_PREFERENCES)).toBe(false);

    expect(setKControlShowTasksFromAllDesktops(DEFAULT_DESKTOP_PREFERENCES, true))
      .toEqual({ ...DEFAULT_DESKTOP_PREFERENCES, showTasksFromAllDesktops: true });
  });
});
