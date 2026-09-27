import { describe, expect, it } from "vitest";
import { getKCalcConstantsSubmenuPosition } from "./kcalcConstantsMenuPosition";

describe("KCalc constants submenu positioning", () => {
  it("opens to the right when ScreenArea has room and flips left at the right edge", () => {
    const area = { x: 0, y: 0, width: 400, height: 300, titleBarHeight: 22 };

    expect(getKCalcConstantsSubmenuPosition({ left: 40, right: 140, top: 50 }, { width: 120, height: 80 }, area)).toEqual({ left: 138, top: 50, opensLeft: false });
    expect(getKCalcConstantsSubmenuPosition({ left: 340, right: 390, top: 50 }, { width: 120, height: 80 }, area)).toEqual({ left: 222, top: 50, opensLeft: true });
  });

  it("clamps vertical position inside ScreenArea without using stale geometry", () => {
    const area = { x: 10, y: 20, width: 300, height: 200, titleBarHeight: 22 };

    expect(getKCalcConstantsSubmenuPosition({ left: 20, right: 80, top: 210 }, { width: 120, height: 80 }, area)).toEqual({ left: 78, top: 140, opensLeft: false });
  });
});
