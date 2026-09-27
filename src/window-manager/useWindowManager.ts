import { createContext, useContext } from "react";
import type {
  DesktopId,
  DesktopWindow,
  ScreenArea,
  ShowDesktopSession,
  WindowBounds,
  WindowLayoutMode,
  WindowLauncherMetadata,
  WorkArea,
} from "./types";

export interface WindowManagerContextValue {
  windows: readonly DesktopWindow[];
  currentDesktopId: DesktopId;
  desktopCount?: number;
  lastActiveWindowIdByDesktop: Record<DesktopId, string | null>;
  showDesktopSessionByDesktop: Record<DesktopId, ShowDesktopSession | null>;
  launcherMetadataByWindowId?: Readonly<Record<string, WindowLauncherMetadata | undefined>>;
  layoutMode?: WindowLayoutMode;
  workArea: WorkArea;
  screenArea?: ScreenArea;
  activateWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  openWindow: (window: DesktopWindow) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, bounds: WindowBounds) => void;
  /** Application-controlled natural-size update; unlike user resize it may target fixed-size windows. */
  fitWindowToContent?: (id: string, bounds: WindowBounds) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreMaximizedWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  setWindowTitle?: (id: string, title: string) => void;
  setWindowLauncherMetadata?: (id: string, metadata: WindowLauncherMetadata | null) => void;
  toggleTaskbarWindow: (id: string) => void;
  switchDesktop: (desktopId: DesktopId) => void;
  setDesktopCount?: (desktopCount: number) => void;
  toggleShowDesktop: () => void;
  moveWindowToDesktop: (id: string, desktopId: DesktopId) => void;
  resetSession?: () => void;
  setWorkArea: (workArea: WorkArea) => void;
}

export const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function useWindowManager(): WindowManagerContextValue {
  const context = useContext(WindowManagerContext);

  if (!context) {
    throw new Error("useWindowManager must be used inside WindowManagerProvider");
  }

  return context;
}

export type WindowMove = Pick<WindowBounds, "x" | "y">;
