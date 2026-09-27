import { describe, expect, it } from "vitest";
import {
  centerWindowInMobileSafeRect,
  clampWindowToMobileSafeRect,
  containWindowInMobileSafeRect,
  fitWindowToMobileWorkArea,
  getMobileEffectiveMinimumSize,
  getMobileWindowSafeRect,
  MOBILE_WINDOW_MARGIN,
  resizeMobileWindowBounds,
} from "./responsiveGeometry";
import type { WindowBounds, WorkArea } from "./types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 278,
  height: 556,
  titleBarHeight: 22,
};

const bounds: WindowBounds = { x: 30, y: 40, width: 220, height: 300 };

describe("mobile window geometry", () => {
  it("uses one logical safe margin around the normal-window safe rect", () => {
    expect(getMobileWindowSafeRect(workArea)).toEqual({
      x: MOBILE_WINDOW_MARGIN,
      y: MOBILE_WINDOW_MARGIN,
      width: 270,
      height: 548,
    });
  });

  it("reduces the margin instead of producing a negative safe rect", () => {
    expect(getMobileWindowSafeRect({ ...workArea, width: 4, height: 4 })).toEqual({
      x: 2,
      y: 2,
      width: 0,
      height: 0,
    });
  });

  it("clamps oversized preferred bounds to the safe rect", () => {
    const clamped = clampWindowToMobileSafeRect(
      { x: -20, y: -30, width: 800, height: 900 },
      workArea,
      520,
      420,
    );

    expect(clamped).toEqual({ x: 4, y: 4, width: 270, height: 548 });
    expect(clamped.x).toBeGreaterThanOrEqual(4);
    expect(clamped.y).toBeGreaterThanOrEqual(4);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(274);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(552);
  });

  it("uses the available mobile size as the effective minimum", () => {
    expect(getMobileEffectiveMinimumSize(520, 420, getMobileWindowSafeRect(workArea))).toEqual({
      width: 270,
      height: 420,
    });
  });

  it("contains an existing mobile window without enlarging it after the area expands", () => {
    expect(containWindowInMobileSafeRect(
      { x: 4, y: 4, width: 232, height: 300 },
      workArea,
    )).toEqual({ x: 4, y: 4, width: 232, height: 300 });
  });

  it("centers the first mobile window after fitting its preferred size", () => {
    expect(centerWindowInMobileSafeRect(bounds, workArea, 120, 160)).toEqual({
      x: 29,
      y: 128,
      width: 220,
      height: 300,
    });
  });

  it("fits a normal window to the full mobile WorkArea without adding a margin", () => {
    expect(fitWindowToMobileWorkArea(
      { x: 120, y: 420, width: 304, height: 218 },
      { x: 0, y: 0, width: 228, height: 360, titleBarHeight: 22 },
      280,
      190,
    )).toEqual({ x: 0, y: 142, width: 228, height: 218 });
  });

  it.each([
    ["east", "e", 500, 0],
    ["south", "s", 0, 500],
    ["west", "w", -500, 0],
    ["north", "n", 0, -500],
    ["south-east", "se", 500, 500],
    ["north-west", "nw", -500, -500],
  ] as const)("keeps a %s resize fully inside the safe rect", (_name, direction, deltaX, deltaY) => {
    const resized = resizeMobileWindowBounds({
      initialBounds: bounds,
      direction,
      deltaX,
      deltaY,
      minimumWidth: 120,
      minimumHeight: 160,
      workArea,
    });

    expect(resized.x).toBeGreaterThanOrEqual(4);
    expect(resized.y).toBeGreaterThanOrEqual(4);
    expect(resized.x + resized.width).toBeLessThanOrEqual(274);
    expect(resized.y + resized.height).toBeLessThanOrEqual(552);
  });

  it("keeps the normal window inside the safe rect when dragged toward every edge", () => {
    for (const position of [
      { x: -500, y: -500 },
      { x: 500, y: -500 },
      { x: -500, y: 500 },
      { x: 500, y: 500 },
    ]) {
      const moved = clampWindowToMobileSafeRect({ ...bounds, ...position }, workArea, 120, 160);

      expect(moved.x).toBeGreaterThanOrEqual(4);
      expect(moved.y).toBeGreaterThanOrEqual(4);
      expect(moved.x + moved.width).toBeLessThanOrEqual(274);
      expect(moved.y + moved.height).toBeLessThanOrEqual(552);
    }
  });
});
