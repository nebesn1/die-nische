import { describe, expect, it } from "vitest";
import type { ScreenArea } from "../types";
import { positionWindowMenu } from "./windowMenuPosition";

const screenArea: ScreenArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 686,
};

describe("window menu positioning", () => {
  it("places the menu below the titlebar icon by default", () => {
    expect(
      positionWindowMenu({
        anchorRect: { left: 100, top: 60, right: 116, bottom: 76, width: 16, height: 16 },
        desktopRect: { left: 0, top: 0, width: 900, height: 686 },
        menuSize: { width: 218, height: 188 },
        screenArea,
      }),
    ).toEqual({ x: 100, y: 77 });
  });

  it("clamps horizontally when the menu would leave the desktop", () => {
    expect(
      positionWindowMenu({
        anchorRect: { left: 850, top: 60, right: 866, bottom: 76, width: 16, height: 16 },
        desktopRect: { left: 0, top: 0, width: 900, height: 686 },
        menuSize: { width: 218, height: 188 },
        screenArea,
      }).x,
    ).toBe(682);
  });

  it("can overlap the Kicker when it remains inside the full screen", () => {
    expect(
      positionWindowMenu({
        anchorRect: { left: 120, top: 444, right: 136, bottom: 460, width: 16, height: 16 },
        desktopRect: { left: 0, top: 0, width: 900, height: 686 },
        menuSize: { width: 218, height: 188 },
        screenArea,
      }).y,
    ).toBe(461);
  });

  it("moves upward only when the menu would leave the full screen", () => {
    expect(
      positionWindowMenu({
        anchorRect: { left: 120, top: 590, right: 136, bottom: 606, width: 16, height: 16 },
        desktopRect: { left: 0, top: 0, width: 900, height: 686 },
        menuSize: { width: 218, height: 188 },
        screenArea,
      }).y,
    ).toBe(401);
  });

  it("does not produce negative coordinates in a tiny screen area", () => {
    expect(
      positionWindowMenu({
        anchorRect: { left: -20, top: -20, right: -4, bottom: -4, width: 16, height: 16 },
        desktopRect: { left: 0, top: 0, width: 100, height: 100 },
        menuSize: { width: 218, height: 188 },
        screenArea: { ...screenArea, width: 100, height: 80 },
      }),
    ).toEqual({ x: 0, y: 0 });
  });
});
