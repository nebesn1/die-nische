import {
  DEFAULT_DESKTOP_ID,
  type DesktopId,
  type DesktopWindow,
  type WindowLayoutMode,
  type WorkArea,
} from "../window-manager/types";
import { getApplicationWindowId } from "./applicationInstanceIds";
import { resolveApplicationInitialBounds } from "./resolveApplicationInitialBounds";
import type { ApplicationDefinition } from "./types";

export interface CreateApplicationWindowOptions {
  zIndex: number;
  isActive: boolean;
  desktopId?: DesktopId;
  workArea?: WorkArea;
  windowId?: string;
  initialBounds?: DesktopWindow["bounds"];
  layoutMode?: WindowLayoutMode;
}

export function getSingletonWindowId(appId: string): string {
  return getApplicationWindowId(appId, 1);
}

export function createApplicationWindow(
  definition: ApplicationDefinition,
  options: CreateApplicationWindowOptions,
): DesktopWindow {
  const bounds = options.initialBounds ?? (options.workArea
    ? resolveApplicationInitialBounds(definition, options.workArea, options.layoutMode)
    : { ...definition.window.bounds });

  return {
    id: options.windowId ?? getSingletonWindowId(definition.appId),
    appId: definition.appId,
    baseTitle: definition.defaultTitle,
    title: definition.defaultTitle,
    iconId: definition.iconId,
    desktopId: options.desktopId ?? DEFAULT_DESKTOP_ID,
    bounds,
    preferredBounds: { ...definition.window.bounds },
    zIndex: options.zIndex,
    isActive: options.isActive,
    state: "normal",
    isDraggable: true,
    minimumWidth: definition.window.minimumWidth,
    minimumHeight: definition.window.minimumHeight,
    isResizable: definition.window.isResizable,
    isMinimizable: definition.window.isMinimizable,
    isMaximizable: definition.window.isMaximizable ?? true,
    alwaysOnTop: definition.window.alwaysOnTop === true,
  };
}
