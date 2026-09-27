import { describe, expect, it } from "vitest";
import type { DesktopWindow } from "../types";
import { createWindowMenuEntries } from "./windowMenuModel";
import {
  getFirstEnabledWindowMenuItemId,
  getLastEnabledWindowMenuItemId,
  getNextEnabledWindowMenuItemId,
  initialWindowMenuState,
  windowMenuReducer,
} from "./windowMenuState";

const desktopWindow: DesktopWindow = {
  id: "app:konqueror",
  appId: "konqueror",
  title: "Conquer your Desktop! - Konqueror",
  iconId: "konqueror",
  desktopId: 1,
  bounds: { x: 80, y: 60, width: 560, height: 420 },
  zIndex: 30,
  isActive: true,
  state: "normal",
  isDraggable: true,
  minimumWidth: 420,
  minimumHeight: 280,
  isResizable: true,
};

describe("window menu state", () => {
  it("starts closed and opens a single window menu", () => {
    const opened = windowMenuReducer(initialWindowMenuState, {
      type: "open",
      windowId: "a",
      anchor: { left: 1, top: 2, right: 17, bottom: 18, width: 16, height: 16 },
      activeItemId: "minimize",
    });

    expect(initialWindowMenuState.openWindowId).toBeNull();
    expect(opened.openWindowId).toBe("a");
    expect(opened.activeItemId).toBe("minimize");
    expect(opened.openSubmenuId).toBeNull();
  });

  it("opening another window replaces the previous one", () => {
    const first = windowMenuReducer(initialWindowMenuState, {
      type: "open",
      windowId: "a",
      anchor: { left: 1, top: 2, right: 17, bottom: 18, width: 16, height: 16 },
      activeItemId: "minimize",
    });
    const second = windowMenuReducer(first, {
      type: "open",
      windowId: "b",
      anchor: { left: 4, top: 5, right: 20, bottom: 21, width: 16, height: 16 },
      activeItemId: "close",
    });

    expect(second.openWindowId).toBe("b");
    expect(second.activeItemId).toBe("close");
  });

  it("close clears submenu, active item, and anchor", () => {
    const opened = windowMenuReducer(initialWindowMenuState, {
      type: "open",
      windowId: "a",
      anchor: { left: 1, top: 2, right: 17, bottom: 18, width: 16, height: 16 },
      activeItemId: "to-desktop",
    });
    const withSubmenu = windowMenuReducer(opened, { type: "open-submenu", submenuId: "to-desktop" });

    expect(windowMenuReducer(withSubmenu, { type: "close" })).toEqual(initialWindowMenuState);
  });

  it("records and closes the move to desktop submenu only", () => {
    const opened = windowMenuReducer(initialWindowMenuState, {
      type: "open",
      windowId: "a",
      anchor: { left: 1, top: 2, right: 17, bottom: 18, width: 16, height: 16 },
      activeItemId: "to-desktop",
    });
    const invalid = windowMenuReducer(opened, { type: "open-submenu", submenuId: "missing" });
    const valid = windowMenuReducer(opened, { type: "open-submenu", submenuId: "to-desktop" });

    expect(invalid.openSubmenuId).toBeNull();
    expect(valid.openSubmenuId).toBe("to-desktop");
    expect(windowMenuReducer(valid, { type: "close-submenu" }).openSubmenuId).toBeNull();
  });

  it("skips separators and disabled entries during keyboard navigation", () => {
    const entries = createWindowMenuEntries(desktopWindow);

    expect(getFirstEnabledWindowMenuItemId(entries)).toBe("to-desktop");
    expect(getNextEnabledWindowMenuItemId(entries, "maximize", "next")).toBe("close");
    expect(getNextEnabledWindowMenuItemId(entries, "to-desktop", "next")).toBe("minimize");
    expect(getNextEnabledWindowMenuItemId(entries, "minimize", "previous")).toBe("to-desktop");
    expect(getLastEnabledWindowMenuItemId(entries)).toBe("close");
  });

  it("returns null for empty navigation lists", () => {
    expect(getFirstEnabledWindowMenuItemId([])).toBeNull();
    expect(getLastEnabledWindowMenuItemId([])).toBeNull();
    expect(getNextEnabledWindowMenuItemId([], null, "next")).toBeNull();
  });
});
