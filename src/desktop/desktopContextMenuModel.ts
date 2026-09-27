import type { RegisteredDesktopIconId } from "./desktopIconModel";
import type { DesktopId, ScreenArea, WorkArea } from "../window-manager/types";

export type DesktopContextMenuState =
  | {
      readonly kind: "background";
      readonly requestId: number;
      readonly desktopId: DesktopId;
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: "icon";
      readonly requestId: number;
      readonly desktopId: DesktopId;
      readonly iconId: RegisteredDesktopIconId;
      readonly clientX: number;
      readonly clientY: number;
    }
  | null;

export type DesktopContextMenuAction =
  | "run-command"
  | "configure-desktop"
  | "lock-session"
  | "logout"
  | "open-icon"
  | "empty-trash";

export type DesktopContextMenuEntry =
  | { readonly kind: "separator" }
  | {
      readonly kind: "action";
      readonly action: DesktopContextMenuAction;
      readonly label: string;
      readonly enabled?: boolean;
      readonly title?: string;
    };

const separator: DesktopContextMenuEntry = Object.freeze({ kind: "separator" });

const action = (actionId: DesktopContextMenuAction, label: string): DesktopContextMenuEntry =>
  Object.freeze({ kind: "action", action: actionId, label, enabled: true, title: label });

const desktopBackgroundContextMenuEntries: readonly DesktopContextMenuEntry[] = Object.freeze([
  action("run-command", "Run Command..."),
  separator,
  action("configure-desktop", "Configure Desktop..."),
  separator,
  action("lock-session", "Lock Session"),
  action("logout", 'Log Out "user"...'),
]);

export function getDesktopContextMenuEntries(
  menuState: Exclude<DesktopContextMenuState, null>,
  canEmptyTrash: boolean,
): readonly DesktopContextMenuEntry[] {
  if (menuState.kind === "background") {
    return desktopBackgroundContextMenuEntries;
  }

  if (menuState.iconId !== "desktop-trash") {
    return Object.freeze([action("open-icon", "Open")]);
  }

  return Object.freeze([
    action("open-icon", "Open"),
    separator,
    { kind: "action", action: "empty-trash", label: "Empty Trash", enabled: canEmptyTrash, title: canEmptyTrash ? "Empty Trash" : "Trash is already empty" },
  ]);
}

export type DesktopPopupPosition = {
  readonly left: number;
  readonly top: number;
};

export type DesktopPopupBounds = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export function getDesktopPopupLocalPosition(
  requested: { readonly clientX: number; readonly clientY: number },
  origin: { readonly left: number; readonly top: number },
): DesktopPopupPosition {
  return {
    left: requested.clientX - origin.left,
    top: requested.clientY - origin.top,
  };
}

export function getDesktopWorkAreaLocalBounds(
  workArea: WorkArea,
  origin: { readonly left: number; readonly top: number },
): DesktopPopupBounds {
  return {
    left: workArea.x - origin.left,
    top: workArea.y - origin.top,
    width: Math.max(0, workArea.width),
    height: Math.max(0, workArea.height),
  };
}

export function getDesktopScreenAreaLocalBounds(
  screenArea: ScreenArea,
  origin: { readonly left: number; readonly top: number },
): DesktopPopupBounds {
  return {
    left: screenArea.x - origin.left,
    top: screenArea.y - origin.top,
    width: Math.max(0, screenArea.width),
    height: Math.max(0, screenArea.height),
  };
}

export function clampDesktopContextMenuPosition(
  requested: DesktopPopupPosition,
  popup: { readonly width: number; readonly height: number },
  bounds: DesktopPopupBounds,
): DesktopPopupPosition {
  const maximumLeft = Math.max(bounds.left, bounds.left + bounds.width - Math.max(0, popup.width));
  const maximumTop = Math.max(bounds.top, bounds.top + bounds.height - Math.max(0, popup.height));

  return {
    left: Math.round(Math.min(Math.max(requested.left, bounds.left), maximumLeft)),
    top: Math.round(Math.min(Math.max(requested.top, bounds.top), maximumTop)),
  };
}
