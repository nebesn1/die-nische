import type { DesktopId, DesktopWindow, ScreenArea, WindowBounds } from "../types";

export const CLOSE_K_MENU_EVENT = "kde3:close-k-menu";
export const CLOSE_WINDOW_MENU_EVENT = "kde3:close-window-menu";

export type WindowMenuCommandId = "minimize" | "maximize" | "close";

export type WindowMenuEntry =
  | WindowMenuCommandEntry
  | WindowMenuSubmenuEntry
  | WindowMenuDesktopEntry
  | WindowMenuSeparatorEntry;

export interface WindowMenuCommandEntry {
  type: "command";
  id: WindowMenuCommandId;
  label: string;
  iconId: string;
  enabled: boolean;
  disabledReason?: string;
}

export interface WindowMenuSubmenuEntry {
  type: "submenu";
  id: "to-desktop";
  label: string;
  iconId: string;
  enabled: boolean;
  children: readonly WindowMenuDesktopEntry[];
}

export interface WindowMenuDesktopEntry {
  type: "desktop";
  id: `desktop-${DesktopId}`;
  label: string;
  desktopId: DesktopId;
  enabled: boolean;
  isCurrent: boolean;
}

export interface WindowMenuSeparatorEntry {
  type: "separator";
  id: string;
}

export type WindowMenuExecutableEntry = Exclude<WindowMenuEntry, WindowMenuSeparatorEntry>;

export interface WindowMenuAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface WindowMenuPosition {
  x: number;
  y: number;
}

export interface WindowMenuState {
  openWindowId: string | null;
  openSubmenuId: string | null;
  activeItemId: string | null;
  anchor: WindowMenuAnchorRect | null;
}

export interface WindowMenuContextValue {
  state: WindowMenuState;
  openWindowMenu: (windowId: string, anchor: WindowMenuAnchorRect) => void;
  toggleWindowMenu: (windowId: string, anchor: WindowMenuAnchorRect) => void;
  closeWindowMenu: (returnFocus: boolean) => void;
  setActiveItem: (itemId: string | null) => void;
  openSubmenu: (submenuId: string) => void;
  closeSubmenu: () => void;
}

export interface WindowMenuPanelProps {
  desktopWindow: DesktopWindow;
  entries: readonly WindowMenuEntry[];
  menuId: string;
  position: WindowMenuPosition;
}

export type WindowMenuPlacementInput = {
  anchorRect: WindowMenuAnchorRect;
  menuSize: Pick<WindowBounds, "width" | "height">;
  desktopRect: Pick<WindowMenuAnchorRect, "left" | "top" | "width" | "height">;
  screenArea: ScreenArea;
};
