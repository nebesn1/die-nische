import type { ReactNode } from "react";
import { getMobileWindowPresentationPolicy } from "./mobileWindowPresentation";

export type WindowState = "normal" | "minimized" | "maximized";
export type WindowLayoutMode = "desktop" | "mobile";
export type RestorableWindowState = "normal" | "maximized";
export type WindowId = string;
export type ApplicationId = string;
export type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export type DesktopId = number;

export const DEFAULT_DESKTOP_ID: DesktopId = 1;

export const MIN_DESKTOP_COUNT = DEFAULT_DESKTOP_ID;
export const DEFAULT_DESKTOP_COUNT = 4;
export const MAX_DESKTOP_COUNT = 20;

export const normalizeDesktopCount = (desktopCount: number): number =>
  Number.isInteger(desktopCount)
    ? Math.min(MAX_DESKTOP_COUNT, Math.max(MIN_DESKTOP_COUNT, desktopCount))
    : DEFAULT_DESKTOP_COUNT;

export const getDesktopIds = (desktopCount: number): readonly DesktopId[] =>
  Array.from({ length: normalizeDesktopCount(desktopCount) }, (_, index) => index + 1);

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowBoundsByLayoutMode = Partial<Record<WindowLayoutMode, WindowBounds>>;

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
  titleBarHeight: number;
}

/** Full viewport bounds used by transient popups and normal-window recovery. */
export interface ScreenArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShowDesktopSession {
  readonly windowIds: readonly string[];
  readonly previouslyActiveWindowId: string | null;
}

/** Small application-reported semantic state needed by desktop launchers. */
export interface WindowLauncherMetadata {
  readonly isHomeLocation: boolean;
  /** Serializable application-reported icon identity for task surfaces. */
  readonly semanticIconId?: string;
}

export interface DesktopWindow {
  id: WindowId;
  appId: ApplicationId;
  /** Application-provided title before WindowManager collision disambiguation. */
  baseTitle?: string;
  /** Shell-derived display caption consumed by all window-caption surfaces. */
  title: string;
  iconId: string;
  desktopId: DesktopId;
  bounds: WindowBounds;
  /** Registry-provided natural size used to initialize a desktop profile after mobile-first launch. */
  preferredBounds?: WindowBounds;
  /** Runtime-only normal geometry, kept independently for each responsive mode. */
  normalBoundsByMode?: WindowBoundsByLayoutMode;
  zIndex: number;
  isActive: boolean;
  /** Monotonic UI-only signal for an explicit window focus handoff. */
  focusRequestId?: number;
  state: WindowState;
  restoreBounds?: WindowBounds;
  /** Runtime-only maximize restore geometry, kept independently for each responsive mode. */
  restoreBoundsByMode?: WindowBoundsByLayoutMode;
  stateBeforeMinimize?: RestorableWindowState;
  isDraggable: boolean;
  minimumWidth: number;
  minimumHeight: number;
  isResizable: boolean;
  /** Omitted legacy windows retain the established minimizable behavior. */
  isMinimizable?: boolean;
  /** Omitted legacy windows retain the established maximizable behavior. */
  isMaximizable?: boolean;
  /** Keep this normal application above ordinary application windows. */
  alwaysOnTop?: boolean;
}

/** Generic WindowManager layer boundary, not an application-specific CSS z-index. */
export const WINDOW_ALWAYS_ON_TOP_Z_INDEX_BASE = 1_000_000;

export const isWindowMinimizable = (desktopWindow: Pick<DesktopWindow, "isMinimizable">): boolean =>
  desktopWindow.isMinimizable !== false;

export const isWindowMaximizable = (desktopWindow: Pick<DesktopWindow, "isMaximizable">): boolean =>
  desktopWindow.isMaximizable !== false;

/** True when the current layout must present the window against the full usable Work Area. */
export const isWindowPresentedMaximized = (
  desktopWindow: Pick<DesktopWindow, "appId" | "state">,
  layoutMode: WindowLayoutMode,
): boolean => layoutMode === "mobile"
  ? desktopWindow.state !== "minimized" && getMobileWindowPresentationPolicy(desktopWindow.appId) === "enforced-maximized"
  : desktopWindow.state === "maximized";

export const isWindowAlwaysOnTop = (desktopWindow: Pick<DesktopWindow, "alwaysOnTop">): boolean =>
  desktopWindow.alwaysOnTop === true;

export const getWindowLayeredZIndex = (
  sequence: number,
  desktopWindow: Pick<DesktopWindow, "alwaysOnTop">,
): number => (isWindowAlwaysOnTop(desktopWindow) ? WINDOW_ALWAYS_ON_TOP_Z_INDEX_BASE : 0) + sequence;

export const getWindowZIndexSequence = (zIndex: number): number =>
  zIndex >= WINDOW_ALWAYS_ON_TOP_Z_INDEX_BASE ? zIndex - WINDOW_ALWAYS_ON_TOP_Z_INDEX_BASE : zIndex;

export interface RegisteredWindow extends DesktopWindow {
  content: ReactNode;
}
