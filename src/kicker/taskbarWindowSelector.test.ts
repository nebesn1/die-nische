import { describe, expect, it } from "vitest";
import type { DesktopWindow } from "../window-manager/types";
import { getTaskbarWindowAction, selectTaskbarWindows } from "./taskbarWindowSelector";

const taskWindow = (id: string, desktopId: DesktopWindow["desktopId"]): DesktopWindow => ({
  id,
  appId: "konqueror",
  title: id,
  iconId: "konqueror",
  desktopId,
  bounds: { x: 0, y: 0, width: 320, height: 220 },
  zIndex: 1,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
});

describe("taskbar window source selection", () => {
  const windows = [taskWindow("desktop-1", 1), taskWindow("desktop-2", 2), taskWindow("desktop-3", 3)];

  it("keeps the existing current-desktop source when the preference is false", () => {
    expect(selectTaskbarWindows(windows, 1, false).map((window) => window.id)).toEqual(["desktop-1"]);
    expect(selectTaskbarWindows(windows, 2, false).map((window) => window.id)).toEqual(["desktop-2"]);
  });

  it("keeps all open window records in stable creation order when the preference is true", () => {
    expect(selectTaskbarWindows(windows, 2, true)).toBe(windows);
  });

  it("focuses an off-desktop task by exact window identity instead of treating it as minimized", () => {
    expect(getTaskbarWindowAction(taskWindow("desktop-3", 3), 1)).toBe("focus-window");
    expect(getTaskbarWindowAction(taskWindow("desktop-1", 1), 1)).toBe("toggle-window");
  });
});
