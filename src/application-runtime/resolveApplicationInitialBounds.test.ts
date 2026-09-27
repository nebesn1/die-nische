import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "./applicationRegistry";
import { getCenteredWindowBounds, resolveApplicationInitialBounds } from "./resolveApplicationInitialBounds";
import type { WorkArea } from "../window-manager/types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 1200,
  height: 900,
  titleBarHeight: 22,
};

const konquerorDefinition = getApplicationDefinition("konqueror");
const aboutDefinition = getApplicationDefinition("about-kde");
const kcalcDefinition = getApplicationDefinition("kcalc");
const kwriteDefinition = getApplicationDefinition("kwrite");

if (!konquerorDefinition || !aboutDefinition || !kcalcDefinition || !kwriteDefinition) {
  throw new Error("Application definitions are required for initial bounds tests");
}

describe("resolveApplicationInitialBounds", () => {
  it("centers resolved initial dimensions in the work area instead of using registry x/y", () => {
    expect(resolveApplicationInitialBounds(kcalcDefinition, workArea)).toMatchObject({
      x: 464,
      y: 309,
      width: 273,
      height: 282,
    });
    expect(resolveApplicationInitialBounds(kcalcDefinition, workArea).x).not.toBe(kcalcDefinition.window.bounds.x);
  });

  it("uses stable integer centering for odd work area dimensions", () => {
    expect(getCenteredWindowBounds(
      { x: 13, y: 7, width: 1001, height: 701, titleBarHeight: 22 },
      { x: 0, y: 0, width: 320, height: 420 },
    )).toEqual({ x: 354, y: 148, width: 320, height: 420 });
  });

  it("centers the final size after initial sizing policy resolution", () => {
    const smallerWorkArea = { ...workArea, height: 600 };
    const bounds = resolveApplicationInitialBounds(konquerorDefinition, smallerWorkArea);

    expect(bounds).toMatchObject({ x: 275, y: 84, width: 650, height: 432 });
  });

  it("uses Work Area rather than the taller screen area for vertical centering", () => {
    const bounds = resolveApplicationInitialBounds(kcalcDefinition, {
      x: 0,
      y: 0,
      width: 900,
      height: 640,
      titleBarHeight: 22,
    });

    expect(bounds).toMatchObject({ x: 314, y: 179, width: 273, height: 282 });
  });

  it("centers different real application sizes independently", () => {
    const kcalcBounds = resolveApplicationInitialBounds(kcalcDefinition, workArea);
    const kwriteBounds = resolveApplicationInitialBounds(kwriteDefinition, workArea);
    const konquerorBounds = resolveApplicationInitialBounds(konquerorDefinition, workArea);

    expect(Math.abs(kcalcBounds.x + kcalcBounds.width / 2 - workArea.width / 2)).toBeLessThanOrEqual(0.5);
    expect(kwriteBounds.x + kwriteBounds.width / 2).toBe(workArea.width / 2);
    expect(konquerorBounds.x + konquerorBounds.width / 2).toBe(workArea.width / 2);
    expect(kcalcBounds.y + kcalcBounds.height / 2).toBe(workArea.height / 2);
    expect(kwriteBounds.y + kwriteBounds.height / 2).toBe(workArea.height / 2);
    expect(konquerorBounds.y + konquerorBounds.height / 2).toBe(workArea.height / 2);
  });

  it("keeps Konqueror at its preferred height in a large work area", () => {
    expect(resolveApplicationInitialBounds(konquerorDefinition, workArea).height).toBe(
      konquerorDefinition.window.bounds.height,
    );
  });

  it("limits Konqueror height by configured work area ratio in smaller work areas", () => {
    const smallWorkArea = { ...workArea, height: 600 };

    expect(resolveApplicationInitialBounds(konquerorDefinition, smallWorkArea).height).toBe(432);
  });

  it("does not reduce Konqueror below its effective minimum height", () => {
    const constrainedWorkArea = { ...workArea, height: 320 };

    expect(resolveApplicationInitialBounds(konquerorDefinition, constrainedWorkArea).height).toBe(280);
  });

  it("uses the current work area as the effective minimum when the work area is smaller than the declared minimum", () => {
    const narrowWorkArea = { ...workArea, height: 160 };

    expect(resolveApplicationInitialBounds(konquerorDefinition, narrowWorkArea).height).toBe(160);
  });

  it("does not produce negative or NaN heights for extremely small work areas", () => {
    const tinyWorkArea = { ...workArea, height: 0 };
    const bounds = resolveApplicationInitialBounds(konquerorDefinition, tinyWorkArea);

    expect(bounds.height).toBe(1);
    expect(Number.isFinite(bounds.height)).toBe(true);
    expect(bounds.height).toBeGreaterThan(0);
    expect(Number.isFinite(bounds.x)).toBe(true);
    expect(Number.isFinite(bounds.y)).toBe(true);
  });

  it("does not apply Konqueror's ratio policy to About", () => {
    const smallWorkArea = { ...workArea, height: 180 };

    expect(resolveApplicationInitialBounds(aboutDefinition, smallWorkArea).height).toBe(
      aboutDefinition.window.bounds.height,
    );
  });

  it("does not mutate the registry default bounds", () => {
    const before = { ...konquerorDefinition.window.bounds };

    resolveApplicationInitialBounds(konquerorDefinition, { ...workArea, height: 320 });

    expect(konquerorDefinition.window.bounds).toEqual(before);
  });

  it("fits and centers a preferred application size in the mobile safe rect", () => {
    const bounds = resolveApplicationInitialBounds(
      konquerorDefinition,
      { x: 0, y: 0, width: 278, height: 556, titleBarHeight: 22 },
      "mobile",
    );

    expect(bounds.x).toBeGreaterThanOrEqual(4);
    expect(bounds.y).toBeGreaterThanOrEqual(4);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(274);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(552);
    expect(bounds.width).toBe(270);
    expect(bounds.height).toBeLessThanOrEqual(548);
  });
});
