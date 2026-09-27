import type { DesktopWindow } from "../window-manager/types";

export type TaskWindowPresentation = {
  readonly isMinimized: boolean;
  readonly iconState: "running" | "minimized";
};

/** Keeps the task label and icon presentation tied to one window's own state. */
export function getTaskWindowPresentation(
  desktopWindow: Pick<DesktopWindow, "state">,
): TaskWindowPresentation {
  const isMinimized = desktopWindow.state === "minimized";

  return {
    isMinimized,
    iconState: isMinimized ? "minimized" : "running",
  };
}
