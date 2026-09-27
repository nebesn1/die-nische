import { describe, expect, it } from "vitest";
import { kMenuEntries } from "./menuModel";
import {
  getFirstEnabledItemId,
  getLastEnabledItemId,
  getNextEnabledItemId,
  initialKMenuState,
  kMenuReducer,
} from "./menuState";
import type { KMenuEntry } from "./types";

const navigationEntries: readonly KMenuEntry[] = [
  { type: "separator", id: "separator-a" },
  {
    type: "command",
    id: "disabled-command",
    label: "Disabled",
    iconId: "system",
    commandId: "disabled",
    enabled: false,
  },
  {
    type: "application",
    id: "enabled-one",
    label: "Enabled One",
    iconId: "konqueror",
    appId: "konqueror",
    enabled: true,
  },
  {
    type: "application",
    id: "enabled-two",
    label: "Enabled Two",
    iconId: "about",
    appId: "about-kde",
    enabled: true,
  },
];

describe("kMenuReducer", () => {
  it("opens from the closed state", () => {
    const state = kMenuReducer(initialKMenuState, { type: "open" });

    expect(state.isOpen).toBe(true);
    expect(state.activeItemId).toBeNull();
  });

  it("closes when toggled from open", () => {
    const open = kMenuReducer(initialKMenuState, { type: "open" });

    expect(kMenuReducer(open, { type: "toggle" })).toEqual(initialKMenuState);
  });

  it("close clears active item and open submenu", () => {
    const state = {
      isOpen: true,
      activeItemId: "app-konqueror-browser",
      openSubmenuId: "category-internet",
    };

    expect(kMenuReducer(state, { type: "close" })).toEqual(initialKMenuState);
  });

  it("opens and closes a submenu without closing the root menu", () => {
    const open = kMenuReducer(initialKMenuState, { type: "open" });
    const withSubmenu = kMenuReducer(open, { type: "open-submenu", submenuId: "category-internet" });
    const withoutSubmenu = kMenuReducer(withSubmenu, { type: "close-submenu" });

    expect(withSubmenu.openSubmenuId).toBe("category-internet");
    expect(withoutSubmenu.isOpen).toBe(true);
    expect(withoutSubmenu.openSubmenuId).toBeNull();
  });

  it("ignores unknown submenu ids", () => {
    const open = kMenuReducer(initialKMenuState, { type: "open" });

    expect(kMenuReducer(open, { type: "open-submenu", submenuId: "missing" })).toBe(open);
  });

  it("opens with a clean state after close", () => {
    const dirtyState = {
      isOpen: true,
      activeItemId: "app-konqueror-browser",
      openSubmenuId: "category-internet",
    };
    const closed = kMenuReducer(dirtyState, { type: "close" });
    const reopened = kMenuReducer(closed, { type: "open" });

    expect(reopened.isOpen).toBe(true);
    expect(reopened.activeItemId).toBeNull();
    expect(reopened.openSubmenuId).toBeNull();
  });

  it("keeps only one open submenu id", () => {
    const open = kMenuReducer(initialKMenuState, { type: "open" });
    const internet = kMenuReducer(open, { type: "open-submenu", submenuId: "category-internet" });

    expect(internet.openSubmenuId).toBe("category-internet");
    expect(typeof internet.openSubmenuId).toBe("string");
  });
});

describe("kMenu navigation helpers", () => {
  it("moves down to the next enabled item", () => {
    expect(getNextEnabledItemId(navigationEntries, "enabled-one", "next")).toBe("enabled-two");
  });

  it("moves up to the previous enabled item", () => {
    expect(getNextEnabledItemId(navigationEntries, "enabled-two", "previous")).toBe("enabled-one");
  });

  it("skips disabled items and separators", () => {
    expect(getFirstEnabledItemId(navigationEntries)).toBe("enabled-one");
    expect(getLastEnabledItemId(navigationEntries)).toBe("enabled-two");
  });

  it("wraps ArrowDown from the end to the beginning", () => {
    expect(getNextEnabledItemId(navigationEntries, "enabled-two", "next")).toBe("enabled-one");
  });

  it("returns null for an empty menu", () => {
    expect(getFirstEnabledItemId([])).toBeNull();
    expect(getLastEnabledItemId([])).toBeNull();
    expect(getNextEnabledItemId([], null, "next")).toBeNull();
  });

  it("finds the first enabled root item in the real model", () => {
    expect(getFirstEnabledItemId(kMenuEntries)).toBe("category-editors");
  });
});
