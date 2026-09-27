import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { VfsNodeId } from "../../vfs/types";
import { isTouchLikePointer } from "../../input/pointerInteraction";
import type { KonquerorDragOperationPlan } from "./dragDropController";
import { getKonquerorSelectedNodeIdsInVisibleOrder, isKonquerorNodeSelected, type KonquerorSelectedNodeIds } from "./selectionModel";
import { useOptionalKonquerorDragDrop } from "./KonquerorDragDropContext";

const itemDragThreshold = 4;

type DragSession = {
  readonly pointerId: number;
  readonly startedNodeId: VfsNodeId;
  readonly startX: number;
  readonly startY: number;
  readonly captureElement: HTMLElement;
  readonly surfaceElement: HTMLElement;
  active: boolean;
  usesSharedCoordinator: boolean;
  plan: KonquerorDragOperationPlan | null;
};

type UseKonquerorItemDragOptions = {
  readonly visibleNodeIds: readonly VfsNodeId[];
  readonly windowId?: string;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly getDragSourceLabel: (nodeId: VfsNodeId) => string;
  readonly canAcceptDropTarget: (nodeId: VfsNodeId) => boolean;
  readonly onReplaceSelection: (nodeId: VfsNodeId) => void;
  readonly onActivateDrag: (rawDraggedNodeIds: readonly VfsNodeId[]) => KonquerorDragOperationPlan | null;
  readonly onDrop: (plan: KonquerorDragOperationPlan, targetFolderNodeId: VfsNodeId, clientX: number, clientY: number) => void;
};

export function useKonquerorItemDrag({
  visibleNodeIds,
  windowId,
  selectedNodeIds,
  getDragSourceLabel,
  canAcceptDropTarget,
  onReplaceSelection,
  onActivateDrag,
  onDrop,
}: UseKonquerorItemDragOptions) {
  const sharedDragDrop = useOptionalKonquerorDragDrop();
  const cancelSharedDrag = sharedDragDrop?.cancelDrag;
  const sessionRef = useRef<DragSession | null>(null);
  const suppressClickNodeIdRef = useRef<VfsNodeId | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<VfsNodeId | null>(null);

  const finish = useCallback((releaseCapture: boolean) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setDropTargetNodeId(null);
    if (releaseCapture && session?.captureElement.hasPointerCapture(session.pointerId)) {
      session.captureElement.releasePointerCapture(session.pointerId);
    }
    return session;
  }, []);

  useEffect(() => () => {
    const session = sessionRef.current;
    if (session?.usesSharedCoordinator && windowId) cancelSharedDrag?.(windowId);
    finish(true);
  }, [cancelSharedDrag, finish, windowId]);

  const resolveTarget = useCallback((surfaceElement: HTMLElement, clientX: number, clientY: number): VfsNodeId | null => {
    const element = document.elementFromPoint(clientX, clientY);
    const item = element?.closest<HTMLElement>("[data-konqueror-node-id]");
    const nodeId = item?.dataset.konquerorNodeId as VfsNodeId | undefined;
    return item && nodeId && surfaceElement.contains(item) && canAcceptDropTarget(nodeId) ? nodeId : null;
  }, [canAcceptDropTarget]);

  const handleItemPointerDown = useCallback((nodeId: VfsNodeId, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !event.isPrimary || isTouchLikePointer(event.pointerType)) return;
    const surfaceElement = event.currentTarget.closest<HTMLElement>("[data-resource-view]");
    if (!surfaceElement) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      pointerId: event.pointerId,
      startedNodeId: nodeId,
      startX: event.clientX,
      startY: event.clientY,
      captureElement: event.currentTarget,
      surfaceElement,
      active: false,
      usesSharedCoordinator: false,
      plan: null,
    };
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.active) {
      if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < itemDragThreshold) return;
      const rawDraggedNodeIds = isKonquerorNodeSelected(selectedNodeIds, session.startedNodeId)
        ? getKonquerorSelectedNodeIdsInVisibleOrder(selectedNodeIds, visibleNodeIds)
        : [session.startedNodeId];
      const plan = onActivateDrag(rawDraggedNodeIds);
      if (!plan) {
        finish(true);
        return;
      }
      if (!isKonquerorNodeSelected(selectedNodeIds, session.startedNodeId)) onReplaceSelection(session.startedNodeId);
      session.plan = plan;
      session.active = true;
      suppressClickNodeIdRef.current = session.startedNodeId;
      if (sharedDragDrop && windowId && windowId !== "konqueror-unmanaged") {
        session.usesSharedCoordinator = sharedDragDrop.beginDrag({
          sourceWindowId: windowId,
          pointerId: session.pointerId,
          startedNodeId: session.startedNodeId,
          sourceLabel: getDragSourceLabel(session.startedNodeId),
          plan,
          clientX: event.clientX,
          clientY: event.clientY,
          onCancel: () => { finish(true); },
        });
      }
    }
    event.preventDefault();
    if (session.usesSharedCoordinator && sharedDragDrop) {
      sharedDragDrop.updateDrag(session.pointerId, event.clientX, event.clientY);
      return;
    }
    setDropTargetNodeId(resolveTarget(session.surfaceElement, event.clientX, event.clientY));
  }, [finish, getDragSourceLabel, onActivateDrag, onReplaceSelection, resolveTarget, selectedNodeIds, sharedDragDrop, visibleNodeIds, windowId]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const targetNodeId = session.active && !session.usesSharedCoordinator ? resolveTarget(session.surfaceElement, event.clientX, event.clientY) : null;
    const completed = finish(true);
    if (completed?.active && completed.usesSharedCoordinator && sharedDragDrop) {
      sharedDragDrop.endDrag(completed.pointerId, event.clientX, event.clientY, {
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
      return;
    }
    if (completed?.active && completed.plan && targetNodeId) {
      onDrop(completed.plan, targetNodeId, event.clientX, event.clientY);
    }
  }, [finish, onDrop, resolveTarget, sharedDragDrop]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (session?.pointerId !== event.pointerId) return;
    if (session.usesSharedCoordinator && windowId) sharedDragDrop?.cancelDrag(windowId);
    finish(true);
  }, [finish, sharedDragDrop, windowId]);

  const handleLostPointerCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (session?.pointerId !== event.pointerId) return;
    if (session.usesSharedCoordinator && windowId) sharedDragDrop?.cancelDrag(windowId);
    finish(false);
  }, [finish, sharedDragDrop, windowId]);

  const consumeSuppressedClick = useCallback((nodeId: VfsNodeId): boolean => {
    if (suppressClickNodeIdRef.current !== nodeId) return false;
    suppressClickNodeIdRef.current = null;
    return true;
  }, []);

  return {
    dropTargetNodeId: sharedDragDrop?.activeDrag?.target?.kind === "folder" && windowId && sharedDragDrop.activeDrag.target.windowId === windowId
      ? sharedDragDrop.activeDrag.target.folderNodeId
      : dropTargetNodeId,
    isDropTargetBackground: Boolean(
      sharedDragDrop && windowId &&
      sharedDragDrop.activeDrag?.target?.kind === "folder" &&
      sharedDragDrop.activeDrag.target.windowId === windowId &&
      sharedDragDrop.activeDrag.target.isBackground,
    ),
    handleItemPointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
    consumeSuppressedClick,
  };
}
