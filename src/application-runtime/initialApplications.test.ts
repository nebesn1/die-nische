import { describe, expect, it } from "vitest";
import { createInitialApplicationWindows } from "./initialApplications";
import { createWindowManagerState } from "../window-manager/windowReducer";
import type { WorkArea } from "../window-manager/types";

const workArea: WorkArea = { x: 0, y: 0, width: 900, height: 600, titleBarHeight: 22 };

describe("createInitialApplicationWindows", () => {
  it("starts with no application windows", () => {
    expect(createInitialApplicationWindows()).toEqual([]);
  });

  it("does not create the historical Konqueror or About bootstrap windows", () => {
    const initialAppIds = createInitialApplicationWindows().map((window) => window.appId);

    expect(initialAppIds).not.toContain("konqueror");
    expect(initialAppIds).not.toContain("about-kde");
    expect(initialAppIds).not.toContain("about-konqueror");
    expect(initialAppIds).not.toContain("about-kwrite");
    expect(initialAppIds).not.toContain("about-konsole");
    expect(initialAppIds).not.toContain("about-kcalc");
  });

  it("remains empty when called repeatedly by Strict Mode initializers", () => {
    expect(createInitialApplicationWindows()).toEqual(createInitialApplicationWindows());
  });

  it("creates the same empty WindowManager invariants as a clean session", () => {
    const state = createWindowManagerState(createInitialApplicationWindows(), workArea);

    expect(state.windows).toEqual([]);
    expect(state.lastActiveWindowIdByDesktop).toEqual({ 1: null, 2: null, 3: null, 4: null });
    expect(state.showDesktopSessionByDesktop).toEqual({ 1: null, 2: null, 3: null, 4: null });
  });

  it("keeps all four virtual desktops free of application windows", () => {
    const state = createWindowManagerState(createInitialApplicationWindows(), workArea);

    [1, 2, 3, 4].forEach((desktopId) => {
      expect(state.windows.filter((window) => window.desktopId === desktopId)).toEqual([]);
    });
  });

  it("has no active task metadata or Show Desktop restore snapshot", () => {
    const state = createWindowManagerState(createInitialApplicationWindows(), workArea);

    expect(state.windows.some((window) => window.isActive)).toBe(false);
    expect(state.launcherMetadataByWindowId).toEqual({});
    expect(state.nextZIndex).toBe(1);
  });
});
