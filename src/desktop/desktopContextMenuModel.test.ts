import { describe, expect, it } from "vitest";
import type { ScreenArea, WorkArea } from "../window-manager/types";
import {
  clampDesktopContextMenuPosition,
  getDesktopContextMenuEntries,
  getDesktopPopupLocalPosition,
  getDesktopScreenAreaLocalBounds,
  getDesktopWorkAreaLocalBounds,
} from "./desktopContextMenuModel";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 554,
  titleBarHeight: 22,
};
const screenArea: ScreenArea = { x: 0, y: 0, width: 900, height: 600 };

describe("desktop context menu model", () => {
  it("defines the exact KDE3 desktop background action order", () => {
    const entries = getDesktopContextMenuEntries(
      { kind: "background", requestId: 1, desktopId: 1, clientX: 100, clientY: 100 },
      false,
    );

    expect(entries.map((entry) => entry.kind === "action" ? entry.action : null)).toEqual([
      "run-command",
      null,
      "configure-desktop",
      null,
      "lock-session",
      "logout",
    ]);
    expect(entries.map((entry) => entry.kind === "action" ? entry.label : null)).toEqual([
      "Run Command...",
      null,
      "Configure Desktop...",
      null,
      "Lock Session",
      'Log Out "user"...',
    ]);
    expect(entries.map((entry) => entry.kind === "action" ? entry.label : null)).not.toContain("Open Home");
    expect(entries.map((entry) => entry.kind === "action" ? entry.label : null)).not.toContain("Find Files/Folders");
    expect(entries.map((entry) => entry.kind === "action" ? entry.label : null)).not.toContain("Open Terminal");
    expect(entries.map((entry) => entry.kind === "action" ? entry.label : null)).not.toContain("About KDE");
  });

  it("renders My Computer as an Open-only icon menu", () => {
    expect(getDesktopContextMenuEntries(
      { kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-my-computer", clientX: 100, clientY: 100 },
      false,
    )).toEqual([{ kind: "action", action: "open-icon", label: "Open", enabled: true, title: "Open" }]);
  });

  it("renders Blog as an Open-only code-owned application launcher", () => {
    expect(getDesktopContextMenuEntries(
      { kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-blog", clientX: 100, clientY: 100 },
      false,
    )).toEqual([{ kind: "action", action: "open-icon", label: "Open", enabled: true, title: "Open" }]);
  });

  it("renders About as an Open-only project launcher", () => {
    expect(getDesktopContextMenuEntries(
      { kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-about-die-nische", clientX: 100, clientY: 100 },
      false,
    )).toEqual([{ kind: "action", action: "open-icon", label: "Open", enabled: true, title: "Open" }]);
  });

  it("renders Trash Open and derives Empty Trash availability without a menu-local snapshot", () => {
    const state = { kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-trash", clientX: 100, clientY: 100 } as const;
    const empty = getDesktopContextMenuEntries(state, false);
    const full = getDesktopContextMenuEntries(state, true);

    expect(empty.at(-1)).toEqual({ kind: "action", action: "empty-trash", label: "Empty Trash", enabled: false, title: "Trash is already empty" });
    expect(full.at(-1)).toEqual({ kind: "action", action: "empty-trash", label: "Empty Trash", enabled: true, title: "Empty Trash" });
  });

  it("converts client coordinates into desktop-local popup coordinates without scroll offsets", () => {
    expect(getDesktopPopupLocalPosition({ clientX: 420, clientY: 318 }, { left: 16, top: 24 })).toEqual({
      left: 404,
      top: 294,
    });
  });

  it("derives work-area bounds locally and keeps the Kicker-reserved bottom unavailable", () => {
    expect(getDesktopWorkAreaLocalBounds(workArea, { left: 10, top: 20 })).toEqual({
      left: -10,
      top: -20,
      width: 900,
      height: 554,
    });
  });

  it("uses the full screen bounds for transient menus so they can overlap the Kicker", () => {
    expect(getDesktopScreenAreaLocalBounds(screenArea, { left: 10, top: 20 })).toEqual({
      left: -10,
      top: -20,
      width: 900,
      height: 600,
    });
    const bounds = getDesktopScreenAreaLocalBounds(screenArea, { left: 0, top: 0 });
    expect(clampDesktopContextMenuPosition({ left: 42, top: 540 }, { width: 192, height: 154 }, bounds)).toEqual({
      left: 42,
      top: 446,
    });
  });

  it("clamps normal, edge, bottom-right, top-left, and oversized popup positions deterministically", () => {
    const bounds = getDesktopWorkAreaLocalBounds(workArea, { left: 0, top: 0 });
    const popup = { width: 192, height: 154 };

    expect(clampDesktopContextMenuPosition({ left: 40, top: 60 }, popup, bounds)).toEqual({ left: 40, top: 60 });
    expect(clampDesktopContextMenuPosition({ left: 890, top: 42 }, popup, bounds)).toEqual({ left: 708, top: 42 });
    expect(clampDesktopContextMenuPosition({ left: 42, top: 540 }, popup, bounds)).toEqual({ left: 42, top: 400 });
    expect(clampDesktopContextMenuPosition({ left: 890, top: 540 }, popup, bounds)).toEqual({ left: 708, top: 400 });
    expect(clampDesktopContextMenuPosition({ left: -10, top: -12 }, popup, bounds)).toEqual({ left: 0, top: 0 });
    expect(clampDesktopContextMenuPosition({ left: 60, top: 60 }, { width: 1200, height: 700 }, bounds)).toEqual({ left: 0, top: 0 });
  });
});
