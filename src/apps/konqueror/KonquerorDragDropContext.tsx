/* eslint-disable react-refresh/only-export-components -- Context provider and its local hook share one runtime boundary. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDesktopTransientPopupLayer } from "../../desktop/DesktopTransientPopupContext";
import { toLogicalCoordinate } from "../../desktop/desktopUiScale";
import { useWindowManager } from "../../window-manager/useWindowManager";
import type { VfsNodeId } from "../../vfs/types";
import { useVfs } from "../../vfs/useVfs";
import { KonquerorDropActionMenu } from "./KonquerorDropActionMenu";
import type { KonquerorDragOperationPlan, KonquerorDropActionRequest } from "./dragDropController";
import {
  getKonquerorDirectDropAction,
  getKonquerorVerticalAutoScrollDirection,
  KONQUEROR_DND_AUTO_EXPAND_DELAY_MS,
  KONQUEROR_DND_AUTO_SCROLL_INTERVAL_MS,
  KONQUEROR_DND_AUTO_SCROLL_STEP_PX,
  type KonquerorDirectDropAction,
  type KonquerorDropModifierState,
} from "./konquerorDragDropModel";

type KonquerorDragSurfaceRegistration = {
  readonly windowId: string;
  readonly viewMode: "tree" | "icons";
  readonly currentDirectoryNodeId: VfsNodeId | null;
  readonly surfaceRef: RefObject<HTMLElement | null>;
  readonly viewportRef: RefObject<HTMLElement | null>;
  readonly canAcceptDropTarget: (nodeId: VfsNodeId) => boolean;
  readonly canAutoExpandDropTarget?: (nodeId: VfsNodeId) => boolean;
  readonly onAutoExpandDropTarget?: (nodeId: VfsNodeId) => void;
};

type KonquerorDragTarget =
  | { readonly kind: "folder"; readonly windowId: string; readonly folderNodeId: VfsNodeId; readonly isBackground: boolean }
  | { readonly kind: "trash"; readonly desktopTargetId: "desktop-trash" };

type ActiveKonquerorDrag = {
  readonly sourceWindowId: string;
  readonly pointerId: number;
  readonly startedNodeId: VfsNodeId;
  readonly plan: KonquerorDragOperationPlan;
  readonly sourceLabel: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly target: KonquerorDragTarget | null;
};

type DragCancelCallback = () => void;
type DropExecutor = {
  executeDropAction(request: KonquerorDropActionRequest, action: KonquerorDirectDropAction): void;
  openMoveToTrash(rawDraggedNodeIds: readonly VfsNodeId[]): void;
};

type DesktopTrashTargetRegistration = {
  readonly targetId: "desktop-trash";
  readonly elementRef: RefObject<HTMLElement | null>;
};

type ResolvedPointerTarget = {
  readonly kind: "folder" | "background" | "trash" | "invalid";
  readonly registration?: KonquerorDragSurfaceRegistration;
  readonly folderNodeId?: VfsNodeId;
};

export type KonquerorDragDropContextValue = {
  readonly activeDrag: ActiveKonquerorDrag | null;
  registerSurface(registration: KonquerorDragSurfaceRegistration): () => void;
  registerDesktopTrashTarget(registration: DesktopTrashTargetRegistration): () => void;
  registerDropExecutor(windowId: string, executor: DropExecutor): () => void;
  beginDrag(input: {
    readonly sourceWindowId: string;
    readonly pointerId: number;
    readonly startedNodeId: VfsNodeId;
    readonly sourceLabel: string;
    readonly plan: KonquerorDragOperationPlan;
    readonly clientX: number;
    readonly clientY: number;
    readonly onCancel: DragCancelCallback;
  }): boolean;
  updateDrag(pointerId: number, clientX: number, clientY: number): void;
  endDrag(pointerId: number, clientX: number, clientY: number, modifiers: KonquerorDropModifierState): void;
  cancelDrag(sourceWindowId?: string): void;
};

const KonquerorDragDropContext = createContext<KonquerorDragDropContextValue | null>(null);

export function useOptionalKonquerorDragDrop(): KonquerorDragDropContextValue | null {
  return useContext(KonquerorDragDropContext);
}

const isVisibleKonquerorWindow = (
  windowId: string,
  windows: ReturnType<typeof useWindowManager>["windows"],
  currentDesktopId: number,
  showDesktopSessionByDesktop: ReturnType<typeof useWindowManager>["showDesktopSessionByDesktop"],
) => {
  const desktopWindow = windows.find((candidate) => candidate.id === windowId);
  return desktopWindow?.appId === "konqueror" &&
    desktopWindow.desktopId === currentDesktopId &&
    desktopWindow.state !== "minimized" &&
    !(showDesktopSessionByDesktop[desktopWindow.desktopId]?.windowIds.includes(desktopWindow.id) ?? false);
};

export function KonquerorDragDropProvider({ children }: { readonly children: ReactNode }) {
  const { currentDesktopId, screenArea, showDesktopSessionByDesktop, windows, workArea } = useWindowManager();
  const transientPopupLayer = useDesktopTransientPopupLayer();
  const vfs = useVfs();
  const [activeDrag, setActiveDrag] = useState<ActiveKonquerorDrag | null>(null);
  const [dropActionRequest, setDropActionRequest] = useState<KonquerorDropActionRequest | null>(null);
  const activeDragRef = useRef<ActiveKonquerorDrag | null>(null);
  const registrationsRef = useRef(new Map<string, KonquerorDragSurfaceRegistration>());
  const desktopTrashTargetRef = useRef<DesktopTrashTargetRegistration | null>(null);
  const executorsRef = useRef(new Map<string, DropExecutor>());
  const cancelCallbackRef = useRef<DragCancelCallback | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverTargetKeyRef = useRef<string | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const scrollKeyRef = useRef<string | null>(null);
  const nextRequestIdRef = useRef(1);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTargetKeyRef.current = null;
  }, []);
  const clearScrollTimer = useCallback(() => {
    if (scrollTimerRef.current !== null) {
      window.clearInterval(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
    scrollKeyRef.current = null;
  }, []);
  const publishActiveDrag = useCallback((next: ActiveKonquerorDrag | null) => {
    activeDragRef.current = next;
    setActiveDrag(next);
  }, []);
  const clearActiveDrag = useCallback(() => {
    clearHoverTimer();
    clearScrollTimer();
    cancelCallbackRef.current = null;
    publishActiveDrag(null);
  }, [clearHoverTimer, clearScrollTimer, publishActiveDrag]);

  const resolvePointerTarget = useCallback((clientX: number, clientY: number): ResolvedPointerTarget | null => {
    const element = document.elementFromPoint(clientX, clientY);
    const desktopTrashTarget = desktopTrashTargetRef.current;
    if (element && desktopTrashTarget?.elementRef.current?.contains(element)) {
      return { kind: "trash" };
    }
    const surface = element?.closest<HTMLElement>("[data-resource-view][data-konqueror-window-id]");
    const windowId = surface?.dataset.konquerorWindowId;
    if (!surface || !windowId || !isVisibleKonquerorWindow(windowId, windows, currentDesktopId, showDesktopSessionByDesktop)) {
      return null;
    }
    const registration = registrationsRef.current.get(windowId);
    if (!registration || registration.surfaceRef.current !== surface) return null;
    const item = element?.closest<HTMLElement>("[data-konqueror-node-id]");
    const nodeId = item?.dataset.konquerorNodeId as VfsNodeId | undefined;
    if (item && surface.contains(item)) {
      return nodeId && registration.canAcceptDropTarget(nodeId)
        ? { kind: "folder", registration, folderNodeId: nodeId }
        : { kind: "invalid", registration };
    }
    const viewport = registration.viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    const scrollbarWidth = viewport ? viewport.offsetWidth - viewport.clientWidth : 0;
    const scrollbarHeight = viewport ? viewport.offsetHeight - viewport.clientHeight : 0;
    const isInsideContent = Boolean(
      viewport && rect &&
      clientX >= rect.left && clientX < rect.right - scrollbarWidth &&
      clientY >= rect.top && clientY < rect.bottom - scrollbarHeight,
    );
    if (element?.closest(".konqueror-directory-header") || !isInsideContent || registration.currentDirectoryNodeId === null) {
      return { kind: "invalid", registration };
    }
    return registration.canAcceptDropTarget(registration.currentDirectoryNodeId)
      ? { kind: "background", registration, folderNodeId: registration.currentDirectoryNodeId }
      : { kind: "invalid", registration };
  }, [currentDesktopId, showDesktopSessionByDesktop, windows]);

  const syncHoverTimer = useCallback((target: ResolvedPointerTarget | null) => {
    const nodeId = target?.kind === "folder" ? target.folderNodeId : undefined;
    const registration = target?.registration;
    const key = registration && nodeId ? `${registration.windowId}:${nodeId}` : null;
    if (
      !key || !registration || !nodeId ||
      registration.viewMode !== "tree" ||
      !registration.canAutoExpandDropTarget?.(nodeId) ||
      !registration.onAutoExpandDropTarget
    ) {
      clearHoverTimer();
      return;
    }
    if (hoverTargetKeyRef.current === key) return;
    clearHoverTimer();
    hoverTargetKeyRef.current = key;
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      if (hoverTargetKeyRef.current !== key || !registration.canAutoExpandDropTarget?.(nodeId)) return;
      registration.onAutoExpandDropTarget?.(nodeId);
      hoverTargetKeyRef.current = null;
    }, KONQUEROR_DND_AUTO_EXPAND_DELAY_MS);
  }, [clearHoverTimer]);

  const updateDrag = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const active = activeDragRef.current;
    if (!active || active.pointerId !== pointerId) return;
    const target = resolvePointerTarget(clientX, clientY);
    const next: ActiveKonquerorDrag = {
      ...active,
      clientX,
      clientY,
      target: target?.kind === "folder" || target?.kind === "background"
        ? { kind: "folder", windowId: target.registration!.windowId, folderNodeId: target.folderNodeId!, isBackground: target.kind === "background" }
        : target?.kind === "trash"
        ? { kind: "trash", desktopTargetId: "desktop-trash" }
        : null,
    };
    publishActiveDrag(next);
    syncHoverTimer(target);

    const viewport = target?.registration?.viewportRef.current;
    if (!viewport) {
      clearScrollTimer();
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const direction = getKonquerorVerticalAutoScrollDirection(
      clientY,
      rect.top,
      rect.bottom,
      viewport.scrollTop,
      maximum,
    );
    const key = direction === 0 ? null : `${target.registration!.windowId}:${direction}`;
    if (!key) {
      clearScrollTimer();
      return;
    }
    if (scrollKeyRef.current === key) return;
    clearScrollTimer();
    scrollKeyRef.current = key;
    scrollTimerRef.current = window.setInterval(() => {
      const latest = activeDragRef.current;
      if (!latest || latest.pointerId !== pointerId) {
        clearScrollTimer();
        return;
      }
      const currentTarget = resolvePointerTarget(latest.clientX, latest.clientY);
      const currentRegistration = currentTarget?.registration;
      const currentViewport = currentRegistration?.viewportRef.current;
      if (!currentRegistration || !currentViewport || currentRegistration.windowId !== target.registration!.windowId) {
        clearScrollTimer();
        return;
      }
      const before = currentViewport.scrollTop;
      const max = Math.max(0, currentViewport.scrollHeight - currentViewport.clientHeight);
      currentViewport.scrollTop = Math.max(0, Math.min(max, before + direction * KONQUEROR_DND_AUTO_SCROLL_STEP_PX));
      if (currentViewport.scrollTop === before) {
        clearScrollTimer();
        return;
      }
      const refreshed = resolvePointerTarget(latest.clientX, latest.clientY);
      const refreshedActive = activeDragRef.current;
      if (refreshedActive) {
        publishActiveDrag({
          ...refreshedActive,
          target: refreshed?.kind === "folder" || refreshed?.kind === "background"
            ? { kind: "folder", windowId: refreshed.registration!.windowId, folderNodeId: refreshed.folderNodeId!, isBackground: refreshed.kind === "background" }
            : refreshed?.kind === "trash"
            ? { kind: "trash", desktopTargetId: "desktop-trash" }
            : null,
        });
      }
      syncHoverTimer(refreshed);
    }, KONQUEROR_DND_AUTO_SCROLL_INTERVAL_MS);
  }, [clearScrollTimer, publishActiveDrag, resolvePointerTarget, syncHoverTimer]);

  const cancelDrag = useCallback((sourceWindowId?: string) => {
    const active = activeDragRef.current;
    if (!active || (sourceWindowId && active.sourceWindowId !== sourceWindowId)) return;
    const cancel = cancelCallbackRef.current;
    clearActiveDrag();
    cancel?.();
  }, [clearActiveDrag]);

  const beginDrag = useCallback((input: {
    readonly sourceWindowId: string;
    readonly pointerId: number;
    readonly startedNodeId: VfsNodeId;
    readonly sourceLabel: string;
    readonly plan: KonquerorDragOperationPlan;
    readonly clientX: number;
    readonly clientY: number;
    readonly onCancel: DragCancelCallback;
  }): boolean => {
    if (!isVisibleKonquerorWindow(input.sourceWindowId, windows, currentDesktopId, showDesktopSessionByDesktop)) return false;
    cancelDrag();
    cancelCallbackRef.current = input.onCancel;
    publishActiveDrag({
      sourceWindowId: input.sourceWindowId,
      pointerId: input.pointerId,
      startedNodeId: input.startedNodeId,
      sourceLabel: input.sourceLabel,
      plan: input.plan,
      clientX: input.clientX,
      clientY: input.clientY,
      target: null,
    });
    return true;
  }, [cancelDrag, currentDesktopId, publishActiveDrag, showDesktopSessionByDesktop, windows]);

  const endDrag = useCallback((pointerId: number, clientX: number, clientY: number, modifiers: KonquerorDropModifierState) => {
    const active = activeDragRef.current;
    if (!active || active.pointerId !== pointerId) return;
    const target = resolvePointerTarget(clientX, clientY);
    const request = (target?.kind === "folder" || target?.kind === "background") && target.folderNodeId
      ? {
          ...active.plan,
          requestId: nextRequestIdRef.current++,
          ownerWindowId: active.sourceWindowId,
          targetWindowId: target.registration!.windowId,
          targetFolderNodeId: target.folderNodeId,
          clientX,
          clientY,
        }
      : null;
    clearActiveDrag();
    if (target?.kind === "trash") {
      executorsRef.current.get(active.sourceWindowId)?.openMoveToTrash(active.plan.rawDraggedNodeIds);
      return;
    }
    if (!request) return;
    const directAction = getKonquerorDirectDropAction(modifiers);
    if (directAction) {
      executorsRef.current.get(request.ownerWindowId)?.executeDropAction(request, directAction);
      return;
    }
    setDropActionRequest(request);
  }, [clearActiveDrag, resolvePointerTarget]);

  const registerSurface = useCallback((registration: KonquerorDragSurfaceRegistration) => {
    registrationsRef.current.set(registration.windowId, registration);
    return () => {
      if (registrationsRef.current.get(registration.windowId) === registration) {
        registrationsRef.current.delete(registration.windowId);
        const active = activeDragRef.current;
        if (active?.sourceWindowId === registration.windowId) cancelDrag(registration.windowId);
        if (active?.target?.kind === "folder" && active.target.windowId === registration.windowId) updateDrag(active.pointerId, active.clientX, active.clientY);
      }
    };
  }, [cancelDrag, updateDrag]);

  const registerDesktopTrashTarget = useCallback((registration: DesktopTrashTargetRegistration) => {
    desktopTrashTargetRef.current = registration;
    return () => {
      if (desktopTrashTargetRef.current === registration) {
        desktopTrashTargetRef.current = null;
        const active = activeDragRef.current;
        if (active?.target?.kind === "trash") {
          updateDrag(active.pointerId, active.clientX, active.clientY);
        }
      }
    };
  }, [updateDrag]);

  const registerDropExecutor = useCallback((windowId: string, executor: DropExecutor) => {
    executorsRef.current.set(windowId, executor);
    return () => {
      if (executorsRef.current.get(windowId) === executor) executorsRef.current.delete(windowId);
      if (dropActionRequest?.ownerWindowId === windowId) setDropActionRequest(null);
    };
  }, [dropActionRequest?.ownerWindowId]);

  useEffect(() => {
    if (!activeDrag) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelDrag();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [activeDrag, cancelDrag]);

  useEffect(() => () => clearActiveDrag(), [clearActiveDrag]);

  const contextValue = useMemo<KonquerorDragDropContextValue>(() => ({
    activeDrag,
    registerSurface,
    registerDesktopTrashTarget,
    registerDropExecutor,
    beginDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  }), [activeDrag, beginDrag, cancelDrag, endDrag, registerDesktopTrashTarget, registerDropExecutor, registerSurface, updateDrag]);
  const screenBounds = screenArea ?? workArea;
  const ghost = activeDrag && transientPopupLayer?.layer
    ? createPortal(
        <div className="konqueror-drag-ghost" style={{ left: toLogicalCoordinate(activeDrag.clientX) + 12, top: toLogicalCoordinate(activeDrag.clientY) + 14 }} aria-hidden="true">
          <span className="konqueror-drag-ghost__icon" aria-hidden="true" />
          <span>{activeDrag.plan.rawDraggedNodeIds.length === 1 ? vfs.state.nodesById[activeDrag.startedNodeId]?.name ?? activeDrag.sourceLabel : `${activeDrag.plan.rawDraggedNodeIds.length} items`}</span>
        </div>,
        transientPopupLayer.layer,
      )
    : null;
  const sharedMenu = dropActionRequest && transientPopupLayer?.layer
    ? createPortal(
        <KonquerorDropActionMenu
          request={dropActionRequest}
          containerRef={transientPopupLayer.layerRef}
          screenArea={screenBounds}
          onDismiss={() => setDropActionRequest(null)}
          onAction={(action) => {
            const request = dropActionRequest;
            setDropActionRequest(null);
            if (action !== "cancel") executorsRef.current.get(request.ownerWindowId)?.executeDropAction(request, action);
          }}
        />,
        transientPopupLayer.layer,
      )
    : null;

  return (
    <KonquerorDragDropContext.Provider value={contextValue}>
      {children}
      {ghost}
      {sharedMenu}
    </KonquerorDragDropContext.Provider>
  );
}
