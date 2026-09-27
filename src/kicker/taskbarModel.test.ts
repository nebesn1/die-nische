import { describe, expect, it } from "vitest";
import type { DesktopWindow } from "../window-manager/types";
import { groupTaskbarWindows } from "./taskbarModel";

const window = (id: string, appId: string, title = id, isActive = false): DesktopWindow => ({
  id,
  appId,
  title,
  iconId: appId,
  desktopId: 1,
  bounds: { x: 0, y: 0, width: 320, height: 220 },
  zIndex: 1,
  isActive,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
});

describe("Taskbar grouping model", () => {
  it("keeps one window as an ordinary task and groups two or more windows by appId", () => {
    const one = window("app:konqueror", "konqueror", "Documents - Konqueror");
    const two = window("app:konqueror::2", "konqueror", "Trash - Konqueror");

    expect(groupTaskbarWindows([], null)).toEqual([]);
    expect(groupTaskbarWindows([one], null)).toEqual([{ type: "window", window: one }]);
    expect(groupTaskbarWindows([one, two], null)).toEqual([{
      type: "group",
      appId: "konqueror",
      windows: [one, two],
      representativeWindowId: one.id,
    }]);
  });

  it("uses creation order for group position and member order, not titles or z-order", () => {
    const first = window("app:konqueror", "konqueror", "Trash - Konqueror");
    const kwrite = window("app:kwrite", "kwrite", "KWrite");
    const second = { ...window("app:konqueror::2", "konqueror", "Documents - Konqueror<2>"), zIndex: 99 };
    const entries = groupTaskbarWindows([first, kwrite, second], null);

    expect(entries.map((entry) => entry.type === "group" ? entry.appId : entry.window.id)).toEqual(["konqueror", "app:kwrite"]);
    expect(entries[0]).toMatchObject({ type: "group", windows: [first, second] });
  });

  it("prefers the active member, then last active, then earliest member as group representative", () => {
    const first = window("app:konqueror", "konqueror", "Documents - Konqueror");
    const second = window("app:konqueror::2", "konqueror", "Trash - Konqueror");

    expect(groupTaskbarWindows([first, second], second.id)[0]).toMatchObject({ representativeWindowId: second.id });
    expect(groupTaskbarWindows([first, { ...second, isActive: true }], first.id)[0]).toMatchObject({ representativeWindowId: second.id });
    expect(groupTaskbarWindows([first, second], null)[0]).toMatchObject({ representativeWindowId: first.id });
  });

  it("prefers an earliest current-desktop member before the global creation-order fallback", () => {
    const firstOffDesktop = { ...window("app:konqueror", "konqueror", "Documents - Konqueror"), desktopId: 1 as const };
    const currentDesktop = { ...window("app:konqueror::2", "konqueror", "Trash - Konqueror"), desktopId: 2 as const };
    const laterOffDesktop = { ...window("app:konqueror::3", "konqueror", "My Computer - Konqueror"), desktopId: 3 as const };

    expect(groupTaskbarWindows([firstOffDesktop, currentDesktop, laterOffDesktop], null, 2)[0])
      .toMatchObject({ representativeWindowId: currentDesktop.id });
  });

  it("does not create a task identity for groups", () => {
    const entries = groupTaskbarWindows([
      window("app:future", "future-app"),
      window("app:future::2", "future-app"),
    ], null);

    expect(entries[0]).toMatchObject({ type: "group", appId: "future-app" });
    expect(entries[0]).not.toHaveProperty("windowId");
    expect(JSON.stringify(entries)).not.toContain("group-window");
  });
});
