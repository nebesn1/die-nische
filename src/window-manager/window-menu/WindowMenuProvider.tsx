import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { useWindowManager } from "../useWindowManager";
import { CLOSE_SHELL_POPUPS_EVENT } from "../../shell/shellPopupEvents";
import { CLOSE_K_MENU_EVENT, CLOSE_WINDOW_MENU_EVENT, type WindowMenuAnchorRect } from "./types";
import { WindowMenuContext } from "./WindowMenuContext";
import { createWindowMenuEntries } from "./windowMenuModel";
import {
  getFirstEnabledWindowMenuItemId,
  initialWindowMenuState,
  windowMenuReducer,
} from "./windowMenuState";

type WindowMenuProviderProps = {
  children: ReactNode;
};

export function WindowMenuProvider({ children }: WindowMenuProviderProps) {
  const { currentDesktopId, desktopCount, layoutMode, showDesktopSessionByDesktop, windows } = useWindowManager();
  const [state, dispatch] = useReducer(windowMenuReducer, initialWindowMenuState);

  const closeWindowMenu = useCallback((returnFocus: boolean) => {
    const windowId = state.openWindowId;

    dispatch({ type: "close" });

    if (returnFocus && windowId) {
      window.requestAnimationFrame(() => {
        document.getElementById(`window-menu-button-${windowId}`)?.focus();
      });
    }
  }, [state.openWindowId]);

  const openWindowMenu = useCallback(
    (windowId: string, anchor: WindowMenuAnchorRect) => {
      const desktopWindow = windows.find((window) => window.id === windowId);
      const isHiddenByShowDesktop =
        desktopWindow ? showDesktopSessionByDesktop[desktopWindow.desktopId]?.windowIds.includes(windowId) : false;

      if (
        !desktopWindow ||
        desktopWindow.state === "minimized" ||
        desktopWindow.desktopId !== currentDesktopId ||
        isHiddenByShowDesktop
      ) {
        return;
      }

      window.dispatchEvent(new Event(CLOSE_K_MENU_EVENT));
      dispatch({
        type: "open",
        windowId,
        anchor,
        activeItemId: getFirstEnabledWindowMenuItemId(createWindowMenuEntries(desktopWindow, desktopCount, layoutMode ?? "desktop")),
      });
    },
    [currentDesktopId, desktopCount, layoutMode, showDesktopSessionByDesktop, windows],
  );

  const toggleWindowMenu = useCallback(
    (windowId: string, anchor: WindowMenuAnchorRect) => {
      if (state.openWindowId === windowId) {
        closeWindowMenu(false);
        return;
      }

      openWindowMenu(windowId, anchor);
    },
    [closeWindowMenu, openWindowMenu, state.openWindowId],
  );

  useEffect(() => {
    const handleCloseWindowMenu = () => {
      dispatch({ type: "close" });
    };

    window.addEventListener(CLOSE_WINDOW_MENU_EVENT, handleCloseWindowMenu);
    window.addEventListener(CLOSE_SHELL_POPUPS_EVENT, handleCloseWindowMenu);

    return () => {
      window.removeEventListener(CLOSE_WINDOW_MENU_EVENT, handleCloseWindowMenu);
      window.removeEventListener(CLOSE_SHELL_POPUPS_EVENT, handleCloseWindowMenu);
    };
  }, []);

  useEffect(() => {
    if (!state.openWindowId) {
      return;
    }

    const desktopWindow = windows.find((window) => window.id === state.openWindowId);
    const isHiddenByShowDesktop =
      desktopWindow
        ? showDesktopSessionByDesktop[desktopWindow.desktopId]?.windowIds.includes(desktopWindow.id) ?? false
        : false;

    if (
      !desktopWindow ||
      desktopWindow.state === "minimized" ||
      desktopWindow.desktopId !== currentDesktopId ||
      isHiddenByShowDesktop
    ) {
      dispatch({ type: "close" });
    }
  }, [currentDesktopId, showDesktopSessionByDesktop, state.openWindowId, windows]);

  useEffect(() => {
    if (!state.openWindowId) {
      return;
    }

    const handleResize = () => {
      dispatch({ type: "close" });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [state.openWindowId]);

  const value = useMemo(
    () => ({
      state,
      openWindowMenu,
      toggleWindowMenu,
      closeWindowMenu,
      setActiveItem: (itemId: string | null) => dispatch({ type: "set-active-item", itemId }),
      openSubmenu: (submenuId: string) => dispatch({ type: "open-submenu", submenuId }),
      closeSubmenu: () => dispatch({ type: "close-submenu" }),
    }),
    [closeWindowMenu, openWindowMenu, state, toggleWindowMenu],
  );

  return <WindowMenuContext.Provider value={value}>{children}</WindowMenuContext.Provider>;
}
