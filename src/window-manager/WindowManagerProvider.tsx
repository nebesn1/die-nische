import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, type ReactNode } from "react";
import { WindowManagerContext } from "./useWindowManager";
import { createWindowManagerState, windowReducer } from "./windowReducer";
import type { DesktopId, DesktopWindow, ScreenArea, WindowLauncherMetadata, WorkArea } from "./types";
import { getLogicalViewportSize } from "../desktop/desktopUiScale";
import { useOptionalResponsiveLayout } from "../desktop/responsiveLayoutContext";
import type { ResponsiveLayoutState } from "../desktop/responsiveLayout";

type WindowManagerProviderProps = {
  initialWindows: readonly DesktopWindow[] | ((workArea: WorkArea) => readonly DesktopWindow[]);
  desktopCount?: number;
  children: ReactNode;
};

const readCssPixelVariable = (name: string): number => {
  const root = document.documentElement;
  const value = window.getComputedStyle(root).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const getViewportWorkArea = (): WorkArea => {
  const panelHeight = readCssPixelVariable("--kde-panel-height");
  const titleBarHeight = readCssPixelVariable("--kde-titlebar-height");
  const viewport = getLogicalViewportSize();

  return {
    x: 0,
    y: 0,
    width: viewport.width,
    height: Math.max(0, viewport.height - panelHeight),
    titleBarHeight,
  };
};

const getViewportScreenArea = (): ScreenArea => ({
  x: 0,
  y: 0,
  ...getLogicalViewportSize(),
});

const getWorkAreaFromResponsiveLayout = (layout: ResponsiveLayoutState): WorkArea => ({
  x: 0,
  y: 0,
  width: layout.logicalWorkAreaWidth,
  height: layout.logicalWorkAreaHeight,
  titleBarHeight: layout.titleBarHeight,
});

const getScreenAreaFromResponsiveLayout = (layout: ResponsiveLayoutState): ScreenArea => ({
  x: 0,
  y: 0,
  width: layout.logicalViewportWidth,
  height: layout.logicalViewportHeight,
});

export function WindowManagerProvider({ initialWindows, desktopCount, children }: WindowManagerProviderProps) {
  const responsiveLayout = useOptionalResponsiveLayout();
  const [state, dispatch] = useReducer(
    windowReducer,
    initialWindows,
    (windowsOrInitializer) => {
      const workArea = responsiveLayout === null
        ? getViewportWorkArea()
        : getWorkAreaFromResponsiveLayout(responsiveLayout);
      const windows =
        typeof windowsOrInitializer === "function" ? windowsOrInitializer(workArea) : windowsOrInitializer;

      return createWindowManagerState(
        windows,
        workArea,
        undefined,
        desktopCount,
        responsiveLayout?.layoutMode ?? "desktop",
      );
    },
  );

  const activateWindow = useCallback((id: string) => {
    dispatch({ type: "activateWindow", id });
  }, []);

  const focusWindow = useCallback((id: string) => {
    dispatch({ type: "focusWindow", id });
  }, []);

  const openWindow = useCallback((window: DesktopWindow) => {
    dispatch({ type: "openWindow", window });
  }, []);

  const getCurrentScreenArea = useCallback((): ScreenArea => responsiveLayout === null
    ? getViewportScreenArea()
    : getScreenAreaFromResponsiveLayout(responsiveLayout), [responsiveLayout]);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: "moveWindow", id, x, y, screenArea: getCurrentScreenArea() });
  }, [getCurrentScreenArea]);

  const resizeWindow = useCallback((id: string, bounds: DesktopWindow["bounds"]) => {
    dispatch({ type: "resizeWindow", id, bounds });
  }, []);

  const fitWindowToContent = useCallback((id: string, bounds: DesktopWindow["bounds"]) => {
    dispatch({ type: "fitWindowToContent", id, bounds });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    dispatch({ type: "minimizeWindow", id });
  }, []);

  const restoreWindow = useCallback((id: string) => {
    dispatch({ type: "restoreWindow", id });
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    dispatch({ type: "maximizeWindow", id });
  }, []);

  const restoreMaximizedWindow = useCallback((id: string) => {
    dispatch({ type: "restoreMaximizedWindow", id });
  }, []);

  const toggleMaximizeWindow = useCallback((id: string) => {
    dispatch({ type: "toggleMaximizeWindow", id });
  }, []);

  const closeWindow = useCallback((id: string) => {
    dispatch({ type: "closeWindow", id });
  }, []);

  const setWindowTitle = useCallback((id: string, title: string) => {
    dispatch({ type: "setWindowTitle", id, title });
  }, []);

  const setWindowLauncherMetadata = useCallback((id: string, metadata: WindowLauncherMetadata | null) => {
    dispatch({ type: "setWindowLauncherMetadata", id, metadata });
  }, []);

  const toggleTaskbarWindow = useCallback((id: string) => {
    dispatch({ type: "toggleTaskbarWindow", id });
  }, []);

  const switchDesktop = useCallback((desktopId: DesktopId) => {
    dispatch({ type: "switchDesktop", desktopId });
  }, []);

  const setDesktopCount = useCallback((nextDesktopCount: number) => {
    dispatch({ type: "setDesktopCount", desktopCount: nextDesktopCount });
  }, []);

  useEffect(() => {
    if (desktopCount !== undefined) setDesktopCount(desktopCount);
  }, [desktopCount, setDesktopCount]);

  const toggleShowDesktop = useCallback(() => {
    dispatch({ type: "toggleShowDesktop", desktopId: state.currentDesktopId });
  }, [state.currentDesktopId]);

  const moveWindowToDesktop = useCallback((id: string, desktopId: DesktopId) => {
    dispatch({ type: "moveWindowToDesktop", id, desktopId });
  }, []);

  const resetSession = useCallback(() => {
    dispatch({ type: "resetSession" });
  }, []);

  const setWorkArea = useCallback((workArea: WorkArea) => {
    dispatch({ type: "setWorkArea", workArea });
  }, []);

  useLayoutEffect(() => {
    if (responsiveLayout !== null) {
      dispatch({
        type: "setWorkArea",
        workArea: getWorkAreaFromResponsiveLayout(responsiveLayout),
        screenArea: getScreenAreaFromResponsiveLayout(responsiveLayout),
        layoutMode: responsiveLayout.layoutMode,
      });
      return;
    }

    let animationFrameId = 0;

    const updateWorkArea = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        dispatch({
          type: "setWorkArea",
          workArea: getViewportWorkArea(),
          screenArea: getViewportScreenArea(),
          layoutMode: "desktop",
        });
      });
    };

    updateWorkArea();
    window.addEventListener("resize", updateWorkArea);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateWorkArea);
    };
  }, [responsiveLayout]);

  const screenArea = getCurrentScreenArea();

  const value = useMemo(
    () => ({
      windows: state.windows,
      currentDesktopId: state.currentDesktopId,
      desktopCount: state.desktopCount,
      lastActiveWindowIdByDesktop: state.lastActiveWindowIdByDesktop,
      showDesktopSessionByDesktop: state.showDesktopSessionByDesktop,
      launcherMetadataByWindowId: state.launcherMetadataByWindowId,
      workArea: state.workArea,
      layoutMode: state.layoutMode,
      screenArea,
      activateWindow,
      closeWindow,
      setWindowTitle,
      setWindowLauncherMetadata,
      focusWindow,
      maximizeWindow,
      moveWindow,
      openWindow,
      resizeWindow,
      fitWindowToContent,
      minimizeWindow,
      restoreMaximizedWindow,
      restoreWindow,
      toggleMaximizeWindow,
      toggleTaskbarWindow,
      switchDesktop,
      setDesktopCount,
      toggleShowDesktop,
      moveWindowToDesktop,
      resetSession,
      setWorkArea,
    }),
    [
      activateWindow,
      closeWindow,
      setWindowTitle,
      setWindowLauncherMetadata,
      focusWindow,
      maximizeWindow,
      minimizeWindow,
      moveWindowToDesktop,
      moveWindow,
      openWindow,
      resizeWindow,
      fitWindowToContent,
      restoreMaximizedWindow,
      restoreWindow,
      setWorkArea,
      state.windows,
      state.currentDesktopId,
      state.desktopCount,
      state.lastActiveWindowIdByDesktop,
      state.showDesktopSessionByDesktop,
      state.launcherMetadataByWindowId,
      state.workArea,
      state.layoutMode,
      screenArea,
      resetSession,
      switchDesktop,
      setDesktopCount,
      toggleShowDesktop,
      toggleMaximizeWindow,
      toggleTaskbarWindow,
    ],
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}
