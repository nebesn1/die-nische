import { useEffect, useMemo, useRef } from "react";
import { useWindowManager } from "../useWindowManager";
import { useWindowMenu } from "./useWindowMenu";
import { createWindowMenuEntries } from "./windowMenuModel";
import { positionWindowMenu } from "./windowMenuPosition";
import { WindowMenuPanel } from "./WindowMenuPanel";
import { toLogicalRect } from "../../desktop/desktopUiScale";

const windowMenuSize = {
  width: 218,
  height: 116,
};

export function WindowMenu() {
  const { state, closeWindowMenu } = useWindowMenu();
  const { desktopCount, layoutMode, screenArea, windows, workArea } = useWindowManager();
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const desktopWindow = state.openWindowId
    ? windows.find((window) => window.id === state.openWindowId)
    : undefined;
  const entries = useMemo(
    () => (desktopWindow ? createWindowMenuEntries(desktopWindow, desktopCount, layoutMode ?? "desktop") : []),
    [desktopCount, desktopWindow, layoutMode],
  );

  useEffect(() => {
    if (!state.openWindowId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (menuRootRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest("[data-window-menu-button]")) {
        return;
      }

      closeWindowMenu(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeWindowMenu, state.openWindowId]);

  useEffect(() => {
    if (!state.openWindowId || !state.activeItemId) {
      return;
    }

    const activeItem = menuRootRef.current?.querySelector<HTMLButtonElement>(
      `[data-window-menu-item-id="${state.activeItemId}"]`,
    );

    activeItem?.focus();
  }, [state.activeItemId, state.openWindowId]);

  if (!desktopWindow || !state.anchor) {
    return null;
  }

  const desktopShell = typeof document === "undefined" ? null : document.querySelector(".desktop-shell");
  const desktopShellRect = desktopShell ? toLogicalRect(desktopShell.getBoundingClientRect()) : undefined;
  const desktopRect = desktopShellRect
    ? {
        left: desktopShellRect.left,
        top: desktopShellRect.top,
        width: desktopShellRect.width,
        height: desktopShellRect.height,
      }
    : {
        left: 0,
        top: 0,
        width: (screenArea ?? workArea).width,
        height: (screenArea ?? workArea).height,
      };
  const position = positionWindowMenu({
    anchorRect: state.anchor,
    desktopRect,
    menuSize: windowMenuSize,
    screenArea: screenArea ?? workArea,
  });

  return (
    <div className="window-menu-root" ref={menuRootRef}>
      <WindowMenuPanel
        desktopWindow={desktopWindow}
        entries={entries}
        menuId={`window-menu-${desktopWindow.id}`}
        position={position}
      />
    </div>
  );
}
