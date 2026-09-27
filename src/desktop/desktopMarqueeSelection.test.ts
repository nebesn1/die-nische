// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDesktopLogicalItemRect,
  getDesktopLogicalPoint,
  getDesktopMarqueeHitIconIds,
  getNormalizedDesktopMarqueeRect,
} from "./desktopMarqueeSelection";

const physicalRect = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});

describe("Desktop marquee geometry", () => {
  beforeEach(() => {
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts physical pointer coordinates into scaled desktop-local logical coordinates", () => {
    expect(getDesktopLogicalPoint({ x: 140, y: 280 }, physicalRect(14, 28, 714, 728))).toEqual({ x: 90, y: 180 });
  });

  it("normalizes all four drag directions in the same logical coordinate space", () => {
    const expected = { left: 10, top: 20, right: 100, bottom: 120, width: 90, height: 100 };

    expect(getNormalizedDesktopMarqueeRect({ x: 10, y: 20 }, { x: 100, y: 120 })).toEqual(expected);
    expect(getNormalizedDesktopMarqueeRect({ x: 100, y: 20 }, { x: 10, y: 120 })).toEqual(expected);
    expect(getNormalizedDesktopMarqueeRect({ x: 10, y: 120 }, { x: 100, y: 20 })).toEqual(expected);
    expect(getNormalizedDesktopMarqueeRect({ x: 100, y: 120 }, { x: 10, y: 20 })).toEqual(expected);
  });

  it("uses the same scaled item geometry for visible rectangle hits", () => {
    const desktopRect = physicalRect(0, 0, 700, 700);
    const itemRects = new Map([
      ["first", getDesktopLogicalItemRect(physicalRect(140, 140, 280, 280), desktopRect)],
      ["second", getDesktopLogicalItemRect(physicalRect(420, 140, 560, 280), desktopRect)],
    ]);
    const marquee = getNormalizedDesktopMarqueeRect({ x: 90, y: 90 }, { x: 250, y: 210 });

    expect(itemRects.get("first")).toMatchObject({ left: 100, top: 100, right: 200, bottom: 200 });
    expect(getDesktopMarqueeHitIconIds(["first", "second"], marquee, itemRects)).toEqual(["first"]);
  });
});
