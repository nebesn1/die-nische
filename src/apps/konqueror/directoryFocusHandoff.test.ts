import { describe, expect, it } from "vitest";
import {
  getKonquerorFocusOwnership,
  shouldFocusKonquerorDirectorySurface,
  shouldRestoreKonquerorDirectoryFocus,
} from "./directoryFocusHandoff";

describe("Konqueror directory focus handoff policy", () => {
  it("hands active, unblocked window focus to the directory surface", () => {
    expect(getKonquerorFocusOwnership({
      isActive: true,
      isBlocked: false,
      activeElementBelongsToApplication: false,
      activeElementIsInteractive: false,
    })).toBe("directory");
  });

  it("preserves focus for Konqueror inputs, selects, buttons, and menu controls", () => {
    expect(getKonquerorFocusOwnership({
      isActive: true,
      isBlocked: false,
      activeElementBelongsToApplication: true,
      activeElementIsInteractive: true,
    })).toBe("interactive-child");
  });

  it("keeps keyboard ownership out of inactive applications and modal or popup states", () => {
    expect(getKonquerorFocusOwnership({
      isActive: false,
      isBlocked: false,
      activeElementBelongsToApplication: false,
      activeElementIsInteractive: false,
    })).toBe("external");
    expect(shouldFocusKonquerorDirectorySurface({
      isActive: true,
      isBlocked: true,
      activeElementBelongsToApplication: false,
      activeElementIsInteractive: false,
    })).toBe(false);
  });

  it("allows an explicit transient view command to restore directory focus without bypassing modal priority", () => {
    const toolbarButtonFocus = {
      isActive: true,
      isBlocked: false,
      activeElementBelongsToApplication: true,
      activeElementIsInteractive: true,
    } as const;

    expect(shouldRestoreKonquerorDirectoryFocus(toolbarButtonFocus, false)).toBe(false);
    expect(shouldRestoreKonquerorDirectoryFocus(toolbarButtonFocus, true)).toBe(true);
    expect(shouldRestoreKonquerorDirectoryFocus({ ...toolbarButtonFocus, isBlocked: true }, true)).toBe(false);
  });
});
