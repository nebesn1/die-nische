import type { ScreenArea } from "../window-manager/types";
import type { KMenuEntry } from "./k-menu/types";

export type TaskbarContextMenuState = {
  readonly requestId: number;
  readonly clientX: number;
  readonly clientY: number;
};

const application = (id: string, label: string, iconId: string, appId: string): KMenuEntry => ({
  type: "application",
  id,
  label,
  iconId,
  appId,
  enabled: true,
});

const taskbarContextMenuEntries: readonly KMenuEntry[] = Object.freeze([
  application("taskbar-configure-panel", "Configure Panel...", "panel-settings", "configure-panel"),
  { type: "separator", id: "taskbar-context-separator" },
  {
    type: "submenu",
    id: "taskbar-help",
    label: "Help",
    iconId: "kmenu-help",
    enabled: true,
    children: [
      application("taskbar-about-kde-panel", "About KDE Panel", "about", "about-kde-panel"),
      application("taskbar-about-kde", "About KDE", "about", "about-kde"),
    ],
  },
]);

export function getTaskbarContextMenuEntries(): readonly KMenuEntry[] {
  return taskbarContextMenuEntries;
}

export type TaskbarContextMenuPosition = {
  readonly left: number;
  readonly top: number;
};

export function getTaskbarContextMenuPosition(
  request: Pick<TaskbarContextMenuState, "clientX" | "clientY">,
  popup: { readonly width: number; readonly height: number },
  bounds: ScreenArea,
): TaskbarContextMenuPosition {
  const rightEdge = bounds.x + bounds.width;
  const bottomEdge = bounds.y + bounds.height;
  const maximumLeft = Math.max(bounds.x, rightEdge - Math.max(0, popup.width));
  const maximumTop = Math.max(bounds.y, bottomEdge - Math.max(0, popup.height));
  const preferredTop = request.clientY - popup.height - 2;

  return {
    left: Math.round(Math.min(Math.max(request.clientX, bounds.x), maximumLeft)),
    top: Math.round(Math.min(Math.max(preferredTop, bounds.y), maximumTop)),
  };
}
