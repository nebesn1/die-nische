import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "./applicationRegistry";
import { createApplicationWindow, getSingletonWindowId } from "./createApplicationWindow";

const konquerorDefinition = getApplicationDefinition("konqueror");

if (!konquerorDefinition) {
  throw new Error("Konqueror definition is required for tests");
}

describe("createApplicationWindow", () => {
  it("copies app id, title, and icon id from the definition", () => {
    const window = createApplicationWindow(konquerorDefinition, { zIndex: 40, isActive: true });

    expect(window.appId).toBe("konqueror");
    expect(window.title).toBe("Conquer your Desktop! - Konqueror");
    expect(window.iconId).toBe("konqueror");
  });

  it("starts in normal state without restore metadata", () => {
    const window = createApplicationWindow(konquerorDefinition, { zIndex: 40, isActive: true });

    expect(window.state).toBe("normal");
    expect(window.restoreBounds).toBeUndefined();
    expect(window.stateBeforeMinimize).toBeUndefined();
  });

  it("uses window constraints from the definition", () => {
    const window = createApplicationWindow(konquerorDefinition, { zIndex: 40, isActive: true });

    expect(window.minimumWidth).toBe(420);
    expect(window.minimumHeight).toBe(280);
    expect(window.isResizable).toBe(true);
    expect(window.isMaximizable).toBe(true);
  });

  it("copies KCalc's disabled resize and maximize capabilities independently", () => {
    const kcalc = getApplicationDefinition("kcalc");

    if (!kcalc) {
      throw new Error("KCalc definition is required for tests");
    }

    const window = createApplicationWindow(kcalc, { zIndex: 40, isActive: true });

    expect(window.isResizable).toBe(false);
    expect(window.isMaximizable).toBe(false);
  });

  it("assigns the requested desktop id", () => {
    const window = createApplicationWindow(konquerorDefinition, {
      zIndex: 40,
      isActive: true,
      desktopId: 3,
    });

    expect(window.desktopId).toBe(3);
  });

  it("copies bounds instead of sharing the definition object", () => {
    const window = createApplicationWindow(konquerorDefinition, { zIndex: 40, isActive: true });

    window.bounds.x = 12;

    expect(konquerorDefinition.window.bounds.x).toBe(500);
  });

  it("uses resolved initial bounds when a work area is provided", () => {
    const window = createApplicationWindow(konquerorDefinition, {
      zIndex: 40,
      isActive: true,
      workArea: {
        x: 0,
        y: 0,
        width: 900,
        height: 600,
        titleBarHeight: 22,
      },
    });

    expect(window.bounds.height).toBe(432);
  });

  it("uses a deterministic singleton window id", () => {
    expect(getSingletonWindowId("konqueror")).toBe("app:konqueror");
    expect(createApplicationWindow(konquerorDefinition, { zIndex: 40, isActive: true }).id).toBe("app:konqueror");
  });
});
