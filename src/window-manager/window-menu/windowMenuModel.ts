import { DEFAULT_DESKTOP_COUNT, getDesktopIds, isWindowMaximizable, isWindowMinimizable, type DesktopWindow, type WindowLayoutMode } from "../types";
import type { WindowMenuEntry } from "./types";

export function createWindowMenuEntries(
  desktopWindow: DesktopWindow,
  desktopCount = DEFAULT_DESKTOP_COUNT,
  layoutMode: WindowLayoutMode = "desktop",
): readonly WindowMenuEntry[] {
  const maximizable = isWindowMaximizable(desktopWindow);
  const mobileCaptionActionsDisabled = layoutMode === "mobile" && desktopWindow.state !== "minimized";
  return [
    {
      type: "submenu",
      id: "to-desktop",
      label: "To Desktop",
      iconId: "desktop-grid",
      enabled: true,
      children: getDesktopIds(desktopCount).map((desktopId) => ({
        type: "desktop",
        id: `desktop-${desktopId}`,
        label: `Desktop ${desktopId}`,
        desktopId,
        enabled: true,
        isCurrent: desktopWindow.desktopId === desktopId,
      })),
    },
    { type: "separator", id: "window-menu-separator-desktop" },
    {
      type: "command",
      id: "minimize",
      label: "Minimize",
      iconId: "minimize",
      enabled: !mobileCaptionActionsDisabled
        && isWindowMinimizable(desktopWindow)
        && (desktopWindow.state === "normal" || desktopWindow.state === "maximized"),
    },
    {
      type: "command",
      id: "maximize",
      label: "Maximize",
      iconId: "maximize",
      enabled: !mobileCaptionActionsDisabled && maximizable && desktopWindow.state === "normal",
    },
    { type: "separator", id: "window-menu-separator-actions" },
    {
      type: "command",
      id: "close",
      label: "Close",
      iconId: "close",
      enabled: true,
    },
  ];
}

export function findWindowMenuEntry(
  entries: readonly WindowMenuEntry[],
  itemId: string,
): WindowMenuEntry | undefined {
  for (const entry of entries) {
    if (entry.id === itemId) {
      return entry;
    }

    if (entry.type === "submenu") {
      const childEntry = entry.children.find((child) => child.id === itemId);

      if (childEntry) {
        return childEntry;
      }
    }
  }

  return undefined;
}
