import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "./applicationRegistry";
import {
  CASCADE_EDGE_MARGIN,
  CASCADE_OFFSET,
  getAdaptiveCascadeCapacity,
  getCascadedApplicationBounds,
  getCascadeVisualSlot,
} from "./cascadePlacement";
import { resolveApplicationInitialBounds } from "./resolveApplicationInitialBounds";
import type { WindowBounds, WorkArea } from "../window-manager/types";

const workArea: WorkArea = { x: 0, y: 0, width: 1_600, height: 900, titleBarHeight: 22 };
const baseBounds: WindowBounds = { x: 600, y: 250, width: 400, height: 300 };

describe("new application instance cascade placement", () => {
  it("uses the cascade step as the Work Area edge safety margin", () => {
    expect(CASCADE_OFFSET).toBe(24);
    expect(CASCADE_EDGE_MARGIN).toBe(CASCADE_OFFSET);
  });

  it("derives a capacity larger than the legacy fixed six slots when geometry permits", () => {
    const capacity = getAdaptiveCascadeCapacity(baseBounds, workArea);

    expect(capacity).toBeGreaterThan(8);
    expect(getCascadeVisualSlot(6, capacity)).toBe(6);
    expect(getCascadedApplicationBounds(baseBounds, 6, workArea)).toMatchObject({ x: 744, y: 394 });
  });

  it("wraps before a candidate would cross the right or bottom safety boundary", () => {
    const constrainedWorkArea: WorkArea = { x: 0, y: 0, width: 1_000, height: 700, titleBarHeight: 22 };
    const constrainedBase: WindowBounds = { x: 500, y: 200, width: 400, height: 350 };
    const capacity = getAdaptiveCascadeCapacity(constrainedBase, constrainedWorkArea);

    expect(capacity).toBe(4);
    expect(getCascadedApplicationBounds(constrainedBase, capacity - 1, constrainedWorkArea)).toMatchObject({
      x: 572,
      y: 272,
    });
    expect(getCascadedApplicationBounds(constrainedBase, capacity, constrainedWorkArea)).toEqual(constrainedBase);
  });

  it("treats an equal edge boundary as safe and one extra pixel as unsafe", () => {
    const edgeWorkArea: WorkArea = { x: 0, y: 0, width: 1_000, height: 700, titleBarHeight: 22 };
    const equalBoundary: WindowBounds = { x: 500, y: 200, width: 452, height: 428 };
    const onePixelOver: WindowBounds = { ...equalBoundary, width: 453 };

    expect(getAdaptiveCascadeCapacity(equalBoundary, edgeWorkArea)).toBe(2);
    expect(getAdaptiveCascadeCapacity(onePixelOver, edgeWorkArea)).toBe(1);
  });

  it("uses the Work Area bottom, rather than the full viewport below the Kicker", () => {
    const windowBounds: WindowBounds = { x: 100, y: 300, width: 300, height: 300 };
    const workAreaAboveKicker: WorkArea = { x: 0, y: 0, width: 1_500, height: 700, titleBarHeight: 22 };
    const fullViewportShape: WorkArea = { ...workAreaAboveKicker, height: 900 };

    expect(getAdaptiveCascadeCapacity(windowBounds, workAreaAboveKicker)).toBe(4);
    expect(getAdaptiveCascadeCapacity(windowBounds, fullViewportShape)).toBeGreaterThan(4);
  });

  it("maps monotonic Runtime serials onto bounded visual slots", () => {
    expect(getCascadeVisualSlot(0, 4)).toBe(0);
    expect(getCascadeVisualSlot(3, 4)).toBe(3);
    expect(getCascadeVisualSlot(4, 4)).toBe(0);
    expect(getCascadeVisualSlot(5, 4)).toBe(1);
    expect(getCascadeVisualSlot(1_000_005, 4)).toBe(1);
    expect(getCascadeVisualSlot(8, 1)).toBe(0);
  });

  it("derives fewer slots for smaller Work Areas and larger application bounds", () => {
    const smallWorkArea: WorkArea = { ...workArea, width: 1_050, height: 680 };
    const largerBounds: WindowBounds = { ...baseBounds, width: 700, height: 500 };

    expect(getAdaptiveCascadeCapacity(baseBounds, smallWorkArea)).toBeLessThan(
      getAdaptiveCascadeCapacity(baseBounds, workArea),
    );
    expect(getAdaptiveCascadeCapacity(largerBounds, workArea)).toBeLessThan(
      getAdaptiveCascadeCapacity(baseBounds, workArea),
    );
  });

  it("uses resolved production application sizes when deriving capacity", () => {
    const definitions = ["kcalc", "konsole", "kwrite", "kfind", "konqueror"]
      .map((appId) => getApplicationDefinition(appId))
      .filter((definition): definition is NonNullable<typeof definition> => definition !== undefined);
    const capacities = Object.fromEntries(definitions.map((definition) => [
      definition.appId,
      getAdaptiveCascadeCapacity(resolveApplicationInitialBounds(definition, workArea), workArea),
    ]));

    expect(capacities.kcalc).toBeGreaterThan(capacities.konqueror);
    expect(capacities.kcalc).toBeGreaterThan(capacities.kfind);
    expect(capacities.kcalc).toBeGreaterThan(capacities.kwrite);
    expect(capacities.konsole).toBeGreaterThan(capacities.konqueror);
    expect(new Set(Object.values(capacities)).size).toBeGreaterThan(1);
  });

  it("keeps slot zero centered and falls back to capacity one for constrained or invalid geometry", () => {
    const nearlyFullBounds: WindowBounds = { x: 10, y: 10, width: 980, height: 680 };
    const tinyWorkArea: WorkArea = { x: 0, y: 0, width: 1_000, height: 700, titleBarHeight: 22 };

    expect(getAdaptiveCascadeCapacity(nearlyFullBounds, tinyWorkArea)).toBe(1);
    expect(getCascadedApplicationBounds(nearlyFullBounds, 1, tinyWorkArea)).toEqual(nearlyFullBounds);
    expect(getAdaptiveCascadeCapacity(baseBounds, workArea, { cascadeOffset: 0 })).toBe(1);

    const invalid = getCascadedApplicationBounds(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY, width: Number.NaN, height: Number.NEGATIVE_INFINITY },
      Number.POSITIVE_INFINITY,
      { x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN, titleBarHeight: Number.NaN },
    );
    expect(Object.values(invalid).every(Number.isFinite)).toBe(true);
    expect(Number.isInteger(invalid.x)).toBe(true);
    expect(Number.isInteger(invalid.y)).toBe(true);
  });

  it("uses the latest Work Area for future windows without changing monotonic serials or existing bounds", () => {
    const wideWorkArea: WorkArea = { x: 0, y: 0, width: 1_600, height: 900, titleBarHeight: 22 };
    const narrowWorkArea: WorkArea = { x: 0, y: 0, width: 1_000, height: 700, titleBarHeight: 22 };
    const serial = 5;
    const existingBounds = getCascadedApplicationBounds(baseBounds, 2, wideWorkArea);
    const wideCapacity = getAdaptiveCascadeCapacity(baseBounds, wideWorkArea);
    const narrowCapacity = getAdaptiveCascadeCapacity(baseBounds, narrowWorkArea);

    expect(wideCapacity).toBeGreaterThan(narrowCapacity);
    expect(getCascadeVisualSlot(serial, wideCapacity)).not.toBe(getCascadeVisualSlot(serial, narrowCapacity));
    expect(existingBounds).toEqual(getCascadedApplicationBounds(baseBounds, 2, wideWorkArea));
  });

  it("preserves the deterministic offset without moving existing windows", () => {
    expect(getCascadedApplicationBounds(baseBounds, 0, workArea)).toEqual(baseBounds);
    expect(getCascadedApplicationBounds(baseBounds, 1, workArea)).toMatchObject({ x: 624, y: 274 });
    expect(getCascadedApplicationBounds(baseBounds, 2, workArea)).toMatchObject({ x: 648, y: 298 });
  });

  it("keeps every mobile cascade slot inside the four-pixel safe rect", () => {
    const mobileWorkArea: WorkArea = { x: 0, y: 0, width: 278, height: 556, titleBarHeight: 22 };
    const mobileBounds: WindowBounds = { x: 0, y: 0, width: 420, height: 520 };

    for (const serial of [0, 1, 4, 20]) {
      const placed = getCascadedApplicationBounds(mobileBounds, serial, mobileWorkArea, "mobile");

      expect(placed.x).toBeGreaterThanOrEqual(4);
      expect(placed.y).toBeGreaterThanOrEqual(4);
      expect(placed.x + placed.width).toBeLessThanOrEqual(274);
      expect(placed.y + placed.height).toBeLessThanOrEqual(552);
    }
  });
});
