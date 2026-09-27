import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { getWindowFrameEdges, resizeNormalWindowBounds } from "./geometry";
import { resizeMobileWindowBounds } from "./responsiveGeometry";
import { ResizeHandles } from "./ResizeHandles";
import { useApplicationRuntime } from "../application-runtime/ApplicationRuntimeContext";
import type { DesktopWindow, ResizeDirection, WindowBounds } from "./types";
import { useWindowManager } from "./useWindowManager";
import { useWindowMenu } from "./window-menu/useWindowMenu";
import type { WindowMenuAnchorRect } from "./window-menu/types";
import { WindowControls } from "./WindowControls";
import { isWindowMaximizable, isWindowMinimizable, isWindowPresentedMaximized } from "./types";
import { useWindowOwnedPopupLayer } from "../desktop/WindowOwnedPopupContext";
import { toLogicalCoordinate, toLogicalRect } from "../desktop/desktopUiScale";
import { useI18n } from "../i18n/useI18n";
import { isPrimaryPointerEvent } from "../input/pointerInteraction";

type WindowFrameProps = {
  desktopWindow: DesktopWindow;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
};

type DragSession = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startBounds: WindowBounds;
  pendingX: number;
  pendingY: number;
  animationFrameId: number;
};

type ResizeSession = {
  pointerId: number;
  direction: ResizeDirection;
  startPointerX: number;
  startPointerY: number;
  initialBounds: WindowBounds;
  pendingBounds: WindowBounds;
  animationFrameId: number;
  captureElement: HTMLElement;
};

const isPrimaryButton = (event: PointerEvent): boolean => isPrimaryPointerEvent(event);

export function WindowFrame({ desktopWindow, icon, className = "", children }: WindowFrameProps) {
  const { t } = useI18n();
  const {
    activateWindow,
    currentDesktopId,
    layoutMode = "desktop",
    minimizeWindow,
    moveWindow,
    resizeWindow,
    showDesktopSessionByDesktop,
    screenArea,
    toggleMaximizeWindow,
    workArea,
  } = useWindowManager();
  const applicationRuntime = useApplicationRuntime();
  const { state: windowMenuState, openWindowMenu, toggleWindowMenu } = useWindowMenu();
  const popupLayer = useWindowOwnedPopupLayer();
  const titlebarRef = useRef<HTMLElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const isMinimized = desktopWindow.state === "minimized";
  const isOnCurrentDesktop = desktopWindow.desktopId === currentDesktopId;
  const isHiddenByShowDesktop =
    showDesktopSessionByDesktop[desktopWindow.desktopId]?.windowIds.includes(desktopWindow.id) ?? false;
  const isHidden = isMinimized || !isOnCurrentDesktop || isHiddenByShowDesktop;
  const isMaximized = isWindowPresentedMaximized(desktopWindow, layoutMode);
  const isMaximizable = isWindowMaximizable(desktopWindow);
  const canToggleMaximize = isMaximizable && !(layoutMode === "mobile" && !isMinimized);
  const isMinimizable = isWindowMinimizable(desktopWindow);
  const isMinimizeDisabled = layoutMode === "mobile" && !isMinimized;
  const canMinimize = isMinimizable && !isMinimizeDisabled;
  const canResize =
    isOnCurrentDesktop
    && layoutMode !== "mobile"
    && !isHiddenByShowDesktop
    && !isMaximized
    && desktopWindow.state === "normal"
    && desktopWindow.isResizable;
  const isWindowMenuOpen = windowMenuState.openWindowId === desktopWindow.id;
  const frameEdges = getWindowFrameEdges(desktopWindow.bounds, workArea);

  const clearDragSession = useCallback(() => {
    const dragSession = dragSessionRef.current;

    if (!dragSession) {
      return;
    }

    const titlebarElement = titlebarRef.current;

    if (titlebarElement?.hasPointerCapture(dragSession.pointerId)) {
      titlebarElement.releasePointerCapture(dragSession.pointerId);
    }

    window.cancelAnimationFrame(dragSession.animationFrameId);
    dragSessionRef.current = null;
    document.body.classList.remove("is-window-dragging");
  }, []);

  const clearResizeSession = useCallback(() => {
    const resizeSession = resizeSessionRef.current;

    if (!resizeSession) {
      return;
    }

    if (resizeSession.captureElement.hasPointerCapture(resizeSession.pointerId)) {
      resizeSession.captureElement.releasePointerCapture(resizeSession.pointerId);
    }

    window.cancelAnimationFrame(resizeSession.animationFrameId);
    resizeSessionRef.current = null;
    document.body.classList.remove("is-window-dragging");
  }, []);

  const clearInteractionSessions = useCallback(() => {
    clearDragSession();
    clearResizeSession();
  }, [clearDragSession, clearResizeSession]);

  useEffect(() => {
    if (isHidden || isMaximized || layoutMode === "mobile") {
      clearInteractionSessions();
    }
  }, [clearInteractionSessions, isHidden, isMaximized, layoutMode]);

  useEffect(() => {
    return () => {
      clearInteractionSessions();
    };
  }, [clearInteractionSessions]);

  const flushPendingMove = () => {
    const dragSession = dragSessionRef.current;

    if (!dragSession) {
      return;
    }

    dragSession.animationFrameId = 0;
    moveWindow(desktopWindow.id, dragSession.pendingX, dragSession.pendingY);
  };

  const flushPendingResize = () => {
    const resizeSession = resizeSessionRef.current;

    if (!resizeSession) {
      return;
    }

    resizeSession.animationFrameId = 0;
    resizeWindow(desktopWindow.id, resizeSession.pendingBounds);
  };

  const finishDrag = (event: PointerEvent<HTMLElement>) => {
    const dragSession = dragSessionRef.current;

    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    window.cancelAnimationFrame(dragSession.animationFrameId);
    moveWindow(desktopWindow.id, dragSession.pendingX, dragSession.pendingY);
    clearDragSession();
  };

  const cancelDrag = (event: PointerEvent<HTMLElement>) => {
    const dragSession = dragSessionRef.current;

    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    clearDragSession();
  };

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    const resizeSession = resizeSessionRef.current;

    if (!resizeSession || resizeSession.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    window.cancelAnimationFrame(resizeSession.animationFrameId);
    resizeWindow(desktopWindow.id, resizeSession.pendingBounds);
    clearResizeSession();
  };

  const cancelResize = (event: PointerEvent<HTMLDivElement>) => {
    const resizeSession = resizeSessionRef.current;

    if (!resizeSession || resizeSession.pointerId !== event.pointerId) {
      return;
    }

    clearResizeSession();
  };

  const handleFramePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isOnCurrentDesktop) {
      return;
    }

    // React portals retain their logical parent path. A pointerdown on an
    // owner popup therefore reaches this frame even though the popup DOM is
    // deliberately a sibling outside the clipped client region.
    if (!popupLayer?.containsPopupTarget(event.target)) {
      popupLayer?.dismissPopups();
    }
    activateWindow(desktopWindow.id);
  };

  const handleTitlebarPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !isPrimaryButton(event) ||
      !isOnCurrentDesktop ||
      layoutMode === "mobile" ||
      !desktopWindow.isDraggable ||
      isMaximized ||
      resizeSessionRef.current
    ) {
      return;
    }

    if ((event.target as Element).closest("[data-window-control]")) {
      return;
    }

    activateWindow(desktopWindow.id);
    popupLayer?.dismissPopups();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-window-dragging");

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startPointerX: toLogicalCoordinate(event.clientX),
      startPointerY: toLogicalCoordinate(event.clientY),
      startBounds: desktopWindow.bounds,
      pendingX: desktopWindow.bounds.x,
      pendingY: desktopWindow.bounds.y,
      animationFrameId: 0,
    };
  };

  const handleResizePointerDown = (direction: ResizeDirection, event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (!isPrimaryButton(event) || !canResize || dragSessionRef.current) {
      return;
    }

    activateWindow(desktopWindow.id);
    popupLayer?.dismissPopups();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-window-dragging");

    resizeSessionRef.current = {
      pointerId: event.pointerId,
      direction,
      startPointerX: toLogicalCoordinate(event.clientX),
      startPointerY: toLogicalCoordinate(event.clientY),
      initialBounds: desktopWindow.bounds,
      pendingBounds: desktopWindow.bounds,
      animationFrameId: 0,
      captureElement: event.currentTarget,
    };
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const resizeSession = resizeSessionRef.current;

    if (!resizeSession || resizeSession.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    resizeSession.pendingBounds = layoutMode === "mobile"
      ? resizeMobileWindowBounds({
        initialBounds: resizeSession.initialBounds,
        direction: resizeSession.direction,
        deltaX: toLogicalCoordinate(event.clientX) - resizeSession.startPointerX,
        deltaY: toLogicalCoordinate(event.clientY) - resizeSession.startPointerY,
        minimumWidth: desktopWindow.minimumWidth,
        minimumHeight: desktopWindow.minimumHeight,
        workArea,
      })
      : resizeNormalWindowBounds({
        initialBounds: resizeSession.initialBounds,
        direction: resizeSession.direction,
        deltaX: toLogicalCoordinate(event.clientX) - resizeSession.startPointerX,
        deltaY: toLogicalCoordinate(event.clientY) - resizeSession.startPointerY,
        minimumWidth: desktopWindow.minimumWidth,
        minimumHeight: desktopWindow.minimumHeight,
        screenArea: screenArea ?? {
          x: workArea.x,
          y: workArea.y,
          width: workArea.width,
          height: workArea.height,
        },
      });

    if (resizeSession.animationFrameId === 0) {
      resizeSession.animationFrameId = window.requestAnimationFrame(flushPendingResize);
    }
  };

  const handleTitlebarPointerMove = (event: PointerEvent<HTMLElement>) => {
    const dragSession = dragSessionRef.current;

    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    dragSession.pendingX = dragSession.startBounds.x + toLogicalCoordinate(event.clientX) - dragSession.startPointerX;
    dragSession.pendingY = dragSession.startBounds.y + toLogicalCoordinate(event.clientY) - dragSession.startPointerY;

    if (dragSession.animationFrameId === 0) {
      dragSession.animationFrameId = window.requestAnimationFrame(flushPendingMove);
    }
  };

  const handleTitlebarDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (!canToggleMaximize || (event.target as Element).closest("[data-window-control]")) {
      return;
    }

    event.preventDefault();
    clearInteractionSessions();
    toggleMaximizeWindow(desktopWindow.id);
  };

  const handleTitlebarContextMenu = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const windowMenuButton = target.closest("[data-window-menu-button]");
    const windowControl = target.closest("[data-window-control]");

    event.preventDefault();

    if (windowControl && !windowMenuButton) {
      return;
    }

    clearInteractionSessions();
    popupLayer?.dismissPopups();
    activateWindow(desktopWindow.id);

    const anchor: WindowMenuAnchorRect = windowMenuButton
      ? toLogicalRect(windowMenuButton.getBoundingClientRect())
      : {
          left: toLogicalCoordinate(event.clientX),
          top: toLogicalCoordinate(event.clientY),
          right: toLogicalCoordinate(event.clientX),
          bottom: toLogicalCoordinate(event.clientY),
          width: 0,
          height: 0,
        };

    openWindowMenu(desktopWindow.id, anchor);
  };

  const handleMinimize = () => {
    if (!canMinimize) {
      return;
    }

    clearInteractionSessions();
    popupLayer?.dismissPopups();
    minimizeWindow(desktopWindow.id);
  };

  const handleToggleMaximize = () => {
    if (!canToggleMaximize) {
      return;
    }

    clearInteractionSessions();
    popupLayer?.dismissPopups();
    toggleMaximizeWindow(desktopWindow.id);
  };

  const handleClose = () => {
    clearInteractionSessions();
    popupLayer?.dismissPopups();
    if (applicationRuntime) {
      applicationRuntime.requestWindowClose(desktopWindow.id);
    }
  };

  const handleWindowMenuButtonPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleWindowMenuButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    clearInteractionSessions();
    popupLayer?.dismissPopups();
    activateWindow(desktopWindow.id);
    toggleWindowMenu(desktopWindow.id, toLogicalRect(event.currentTarget.getBoundingClientRect()));
  };

  const handleWindowMenuButtonDoubleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <section
      className={`window-frame ${desktopWindow.isActive ? "is-active" : "is-inactive"} ${
        isMinimized ? "is-minimized" : ""
      } ${!isOnCurrentDesktop ? "is-off-desktop" : ""} ${
        isHiddenByShowDesktop ? "is-show-desktop-hidden" : ""
      } ${isMaximized ? "is-maximized" : ""} ${className}`}
      aria-label={desktopWindow.title}
      aria-current={desktopWindow.isActive ? "true" : undefined}
      aria-hidden={isHidden ? true : undefined}
      data-active={desktopWindow.isActive ? "true" : "false"}
      data-current-desktop={isOnCurrentDesktop ? "true" : "false"}
      data-desktop-id={desktopWindow.desktopId}
      data-show-desktop-hidden={isHiddenByShowDesktop ? "true" : "false"}
      data-window-state={desktopWindow.state}
      hidden={isHidden}
      onPointerDown={handleFramePointerDown}
      style={{
        left: `${frameEdges.left}px`,
        top: `${frameEdges.top}px`,
        right: `${frameEdges.right}px`,
        bottom: `${frameEdges.bottom}px`,
        zIndex: desktopWindow.zIndex,
      }}
    >
      <header
        ref={titlebarRef}
        className="window-titlebar"
        onPointerDown={handleTitlebarPointerDown}
        onPointerMove={handleTitlebarPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
        onDoubleClick={handleTitlebarDoubleClick}
        onContextMenu={handleTitlebarContextMenu}
      >
        <button
          id={`window-menu-button-${desktopWindow.id}`}
          type="button"
          className={`window-titlebar__icon-button${isWindowMenuOpen ? " is-active" : ""}`}
          aria-label={t(isWindowMenuOpen ? "window.closeMenuFor" : "window.openMenuFor", { title: desktopWindow.title })}
          aria-expanded={isWindowMenuOpen}
          aria-controls={`window-menu-${desktopWindow.id}`}
          data-window-control
          data-window-menu-button
          onPointerDown={handleWindowMenuButtonPointerDown}
          onClick={handleWindowMenuButtonClick}
          onDoubleClick={handleWindowMenuButtonDoubleClick}
        >
          {icon}
        </button>
        <span className="window-titlebar__text">{desktopWindow.title}</span>
        <WindowControls
          title={desktopWindow.title}
          isMaximized={isMaximized}
          isMinimizable={isMinimizable}
          isMinimizeDisabled={isMinimizeDisabled}
          isMaximizable={canToggleMaximize}
          onMinimize={handleMinimize}
          onToggleMaximize={handleToggleMaximize}
          onClose={handleClose}
        />
      </header>
      {children}
      {canResize ? (
        <ResizeHandles
          onResizePointerDown={handleResizePointerDown}
          onResizePointerMove={handleResizePointerMove}
          onResizePointerUp={finishResize}
          onResizePointerCancel={cancelResize}
        />
      ) : null}
    </section>
  );
}
