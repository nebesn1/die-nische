import type { DesktopId, DesktopWindow } from "../window-manager/types";

export type TaskbarWindowAction = "focus-window" | "toggle-window";

/** Selects the taskbar source before grouping and layout project it. */
export function selectTaskbarWindows(
  windows: readonly DesktopWindow[],
  currentDesktopId: DesktopId,
  showTasksFromAllDesktops: boolean,
): readonly DesktopWindow[] {
  return showTasksFromAllDesktops
    ? windows
    : windows.filter((desktopWindow) => desktopWindow.desktopId === currentDesktopId);
}

export function getTaskbarWindowAction(
  desktopWindow: Pick<DesktopWindow, "desktopId">,
  currentDesktopId: DesktopId,
): TaskbarWindowAction {
  return desktopWindow.desktopId === currentDesktopId ? "toggle-window" : "focus-window";
}
