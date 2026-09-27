import { describe, expect, it } from "vitest";
import {
  isKeyboardSelectionKey,
  KLIPPER_KEYBOARD_SELECTION_SETTLE_MS,
  shouldRecordKlipperSelection,
} from "./klipperSelection";

describe("Klipper settled selection policy", () => {
  it("records only selection-extending keyboard gestures after a short local settle interval", () => {
    expect(KLIPPER_KEYBOARD_SELECTION_SETTLE_MS).toBe(200);
    expect(isKeyboardSelectionKey("ArrowRight", true)).toBe(true);
    expect(isKeyboardSelectionKey("Home", true)).toBe(true);
    expect(isKeyboardSelectionKey("ArrowRight", false)).toBe(false);
    expect(isKeyboardSelectionKey("a", true)).toBe(false);
  });

  it("excludes Klipper UI and command controls from selection recording", () => {
    const ignored = { closest: () => ({}) } as unknown as EventTarget;
    const selectable = { closest: () => null } as unknown as EventTarget;

    expect(shouldRecordKlipperSelection(ignored)).toBe(false);
    expect(shouldRecordKlipperSelection(selectable)).toBe(true);
  });
});
