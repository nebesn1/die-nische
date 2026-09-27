import { describe, expect, it } from "vitest";
import type { DesktopWindow } from "../types";
import { createWindowMenuEntries, findWindowMenuEntry } from "./windowMenuModel";

const makeWindow = (overrides: Partial<DesktopWindow> = {}): DesktopWindow => ({
  id: "app:konqueror",
  appId: "konqueror",
  title: "Conquer your Desktop! - Konqueror",
  iconId: "konqueror",
  desktopId: 2,
  bounds: { x: 80, y: 60, width: 560, height: 420 },
  zIndex: 30,
  isActive: true,
  state: "normal",
  isDraggable: true,
  minimumWidth: 420,
  minimumHeight: 280,
  isResizable: true,
  ...overrides,
});

describe("window menu model", () => {
  it("builds unique root menu ids in the classic order", () => {
    const entries = createWindowMenuEntries(makeWindow());

    expect(entries.map((entry) => entry.id)).toEqual([
      "to-desktop",
      "window-menu-separator-desktop",
      "minimize",
      "maximize",
      "window-menu-separator-actions",
      "close",
    ]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it("keeps Maximize visible but disabled for maximized windows", () => {
    const entries = createWindowMenuEntries(makeWindow({ state: "maximized" }));

    expect(entries[3]).toMatchObject({ id: "maximize", label: "Maximize", enabled: false });
  });

  it("keeps the maximize entry visible but disabled for non-maximizable windows", () => {
    const entry = createWindowMenuEntries(makeWindow({ isMaximizable: false }))
      .find((candidate) => candidate.id === "maximize");

    expect(entry).toMatchObject({ id: "maximize", enabled: false });
  });

  it("keeps Minimize visible but disabled for a non-minimizable window", () => {
    const entry = createWindowMenuEntries(makeWindow({ isMinimizable: false }))
      .find((candidate) => candidate.id === "minimize");

    expect(entry).toMatchObject({ id: "minimize", enabled: false });
  });

  it("disables caption actions in mobile while keeping Close available", () => {
    const entries = createWindowMenuEntries(makeWindow(), 4, "mobile");

    expect(entries.find((entry) => entry.id === "minimize")).toMatchObject({ enabled: false });
    expect(entries.find((entry) => entry.id === "maximize")).toMatchObject({ enabled: false });
    expect(entries.find((entry) => entry.id === "close")).toMatchObject({ enabled: true });
  });

  it("does not expose the removed Move, Resize, or legacy desktop wording", () => {
    const entries = createWindowMenuEntries(makeWindow());

    expect(entries.find((entry) => entry.id === "move")).toBeUndefined();
    expect(entries.find((entry) => entry.id === "resize")).toBeUndefined();
    expect(entries.find((entry) => entry.id === "move-to-desktop")).toBeUndefined();
    expect(entries.find((entry) => entry.type === "submenu")?.label).toBe("To Desktop");
  });

  it("derives To Desktop destinations from the configured desktop count", () => {
    const submenu = createWindowMenuEntries(makeWindow(), 3).find((entry) => entry.id === "to-desktop");

    expect(submenu?.type).toBe("submenu");

    if (submenu?.type !== "submenu") {
      throw new Error("To Desktop submenu was not created");
    }

    expect(submenu.children.map((entry) => entry.desktopId)).toEqual([1, 2, 3]);
    expect(submenu.children.find((entry) => entry.desktopId === 2)?.isCurrent).toBe(true);
    expect(submenu.children.find((entry) => entry.desktopId === 3)?.isCurrent).toBe(false);
  });

  it("keeps a single configured desktop as the only current destination", () => {
    const submenu = createWindowMenuEntries(makeWindow({ desktopId: 1 }), 1).find((entry) => entry.id === "to-desktop");

    expect(submenu?.type).toBe("submenu");

    if (submenu?.type !== "submenu") {
      throw new Error("To Desktop submenu was not created");
    }

    expect(submenu.children.map((entry) => entry.desktopId)).toEqual([1]);
    expect(submenu.children[0]?.isCurrent).toBe(true);
  });

  it("limits To Desktop to the supported twenty destinations", () => {
    const submenu = createWindowMenuEntries(makeWindow(), 25).find((entry) => entry.id === "to-desktop");

    expect(submenu?.type).toBe("submenu");

    if (submenu?.type !== "submenu") {
      throw new Error("To Desktop submenu was not created");
    }

    expect(submenu.children).toHaveLength(20);
    expect(submenu.children.at(-1)?.desktopId).toBe(20);
    expect(submenu.children.some((entry) => entry.desktopId === 21)).toBe(false);
  });

  it("finds dynamic nested desktop entries", () => {
    const entries = createWindowMenuEntries(makeWindow(), 5);

    expect(findWindowMenuEntry(entries, "desktop-5")).toMatchObject({
      type: "desktop",
      desktopId: 5,
    });
  });
});
