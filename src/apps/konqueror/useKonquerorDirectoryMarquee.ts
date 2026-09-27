import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import type { VfsNodeId } from "../../vfs/types";
import { toLogicalPoint, toLogicalRect } from "../../desktop/desktopUiScale";
import { isTouchLikePointer } from "../../input/pointerInteraction";
import {
  addKonquerorSelectionRange,
  type KonquerorSelectedNodeIds,
} from "./selectionModel";
import {
  getKonquerorMarqueeHitNodeIds,
  getNormalizedKonquerorMarqueeRect,
  type KonquerorMarqueeSelectionMode,
  type KonquerorMarqueePoint,
  type KonquerorMarqueeRect,
} from "./marqueeSelection";

export type { KonquerorMarqueeSelectionMode } from "./marqueeSelection";

type KonquerorMarqueeSession = {
  readonly pointerId: number;
  readonly startClientPoint: KonquerorMarqueePoint;
  readonly startContentPoint: KonquerorMarqueePoint;
  readonly mode: KonquerorMarqueeSelectionMode;
  readonly baselineSelectedNodeIds: KonquerorSelectedNodeIds;
  readonly baselineRangeAnchorNodeId: VfsNodeId | null;
  readonly captureElement: HTMLDivElement;
  readonly viewportElement: HTMLElement;
  active: boolean;
};

type KonquerorMarqueePreview = {
  readonly rect: KonquerorMarqueeRect;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
};

type UseKonquerorDirectoryMarqueeOptions = {
  readonly visibleNodeIds: readonly VfsNodeId[];
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly rangeAnchorNodeId: VfsNodeId | null;
  /** Optional item-local target used only to measure marquee hit geometry. */
  readonly marqueeHitTargetSelector?: string;
  readonly viewportRef?: RefObject<HTMLDivElement | null>;
  readonly onClearSelection: () => void;
  readonly onCommitMarquee: (
    mode: KonquerorMarqueeSelectionMode,
    baselineSelectedNodeIds: KonquerorSelectedNodeIds,
    baselineRangeAnchorNodeId: VfsNodeId | null,
    visibleNodeIds: readonly VfsNodeId[],
    hitNodeIds: KonquerorSelectedNodeIds,
  ) => void;
};

const marqueeDragThreshold = 4;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

const getViewportWidth = (viewportElement: HTMLElement, viewportRect: Pick<DOMRect, "width">): number =>
  viewportElement.clientWidth > 0 ? viewportElement.clientWidth : viewportRect.width;

const getViewportHeight = (viewportElement: HTMLElement, viewportRect: Pick<DOMRect, "height">): number =>
  viewportElement.clientHeight > 0 ? viewportElement.clientHeight : viewportRect.height;

const getContentPoint = (
  clientPoint: KonquerorMarqueePoint,
  viewportElement: HTMLElement,
): KonquerorMarqueePoint => {
  const viewportRect = toLogicalRect(viewportElement.getBoundingClientRect());
  const logicalClientPoint = toLogicalPoint(clientPoint);
  const viewportWidth = getViewportWidth(viewportElement, viewportRect);
  const viewportHeight = getViewportHeight(viewportElement, viewportRect);

  return {
    x: clamp(logicalClientPoint.x - viewportRect.left, 0, viewportWidth) + viewportElement.scrollLeft,
    y: clamp(logicalClientPoint.y - viewportRect.top, 0, viewportHeight) + viewportElement.scrollTop,
  };
};

const isPointInsideViewportContent = (
  clientPoint: KonquerorMarqueePoint,
  viewportElement: HTMLElement,
): boolean => {
  const viewportRect = toLogicalRect(viewportElement.getBoundingClientRect());
  const logicalClientPoint = toLogicalPoint(clientPoint);
  const viewportWidth = getViewportWidth(viewportElement, viewportRect);
  const viewportHeight = getViewportHeight(viewportElement, viewportRect);

  return logicalClientPoint.x >= viewportRect.left &&
    logicalClientPoint.x < viewportRect.left + viewportWidth &&
    logicalClientPoint.y >= viewportRect.top &&
    logicalClientPoint.y < viewportRect.top + viewportHeight;
};

const getMarqueeItemRects = (
  surfaceElement: HTMLDivElement,
  viewportElement: HTMLElement,
  marqueeHitTargetSelector: string | undefined,
): ReadonlyMap<VfsNodeId, KonquerorMarqueeRect> => {
  const viewportRect = toLogicalRect(viewportElement.getBoundingClientRect());
  const itemRectsByNodeId = new Map<VfsNodeId, KonquerorMarqueeRect>();

  for (const itemElement of surfaceElement.querySelectorAll<HTMLElement>("[data-konqueror-node-id]")) {
    const nodeId = itemElement.dataset.konquerorNodeId as VfsNodeId | undefined;
    if (!nodeId) {
      continue;
    }

    const marqueeHitElement = marqueeHitTargetSelector === undefined
      ? itemElement
      : itemElement.querySelector<HTMLElement>(marqueeHitTargetSelector);
    if (!marqueeHitElement) {
      continue;
    }

    const itemRect = toLogicalRect(marqueeHitElement.getBoundingClientRect());
    itemRectsByNodeId.set(nodeId, getNormalizedKonquerorMarqueeRect(
      {
        x: itemRect.left - viewportRect.left + viewportElement.scrollLeft,
        y: itemRect.top - viewportRect.top + viewportElement.scrollTop,
      },
      {
        x: itemRect.right - viewportRect.left + viewportElement.scrollLeft,
        y: itemRect.bottom - viewportRect.top + viewportElement.scrollTop,
      },
    ));
  }

  return itemRectsByNodeId;
};

export function useKonquerorDirectoryMarquee({
  visibleNodeIds,
  selectedNodeIds,
  rangeAnchorNodeId,
  marqueeHitTargetSelector,
  viewportRef,
  onClearSelection,
  onCommitMarquee,
}: UseKonquerorDirectoryMarqueeOptions) {
  const sessionRef = useRef<KonquerorMarqueeSession | null>(null);
  const suppressNextBackgroundClickRef = useRef(false);
  const [preview, setPreview] = useState<KonquerorMarqueePreview | null>(null);

  const endSession = useCallback((releaseCapture: boolean) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setPreview(null);

    if (releaseCapture && session?.captureElement.hasPointerCapture(session.pointerId)) {
      session.captureElement.releasePointerCapture(session.pointerId);
    }

    return session;
  }, []);

  useEffect(() => () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session?.captureElement.hasPointerCapture(session.pointerId)) {
      session.captureElement.releasePointerCapture(session.pointerId);
    }
  }, []);

  const getHitsAt = useCallback((session: KonquerorMarqueeSession, clientPoint: KonquerorMarqueePoint) => {
    const rect = getNormalizedKonquerorMarqueeRect(
      session.startContentPoint,
      getContentPoint(clientPoint, session.viewportElement),
    );
    const hitNodeIds = getKonquerorMarqueeHitNodeIds(
      visibleNodeIds,
      rect,
      getMarqueeItemRects(session.captureElement, session.viewportElement, marqueeHitTargetSelector),
    );

    return { rect, hitNodeIds };
  }, [marqueeHitTargetSelector, visibleNodeIds]);

  const updatePreview = useCallback((session: KonquerorMarqueeSession, clientPoint: KonquerorMarqueePoint) => {
    const { rect, hitNodeIds } = getHitsAt(session, clientPoint);
    const previewNodeIds = session.mode === "add"
      ? addKonquerorSelectionRange(session.baselineSelectedNodeIds, hitNodeIds)
      : hitNodeIds;

    setPreview({ rect, selectedNodeIds: previewNodeIds });
    return hitNodeIds;
  }, [getHitsAt]);

  const handleBackgroundPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.button !== 0 || !event.isPrimary || isTouchLikePointer(event.pointerType)) {
      return;
    }

    const viewportElement = viewportRef?.current ?? event.currentTarget.parentElement ?? event.currentTarget;
    const clientPoint = { x: event.clientX, y: event.clientY };
    if (!isPointInsideViewportContent(clientPoint, viewportElement)) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    suppressNextBackgroundClickRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      pointerId: event.pointerId,
      startClientPoint: clientPoint,
      startContentPoint: getContentPoint(clientPoint, viewportElement),
      mode: event.ctrlKey ? "add" : "replace",
      baselineSelectedNodeIds: selectedNodeIds,
      baselineRangeAnchorNodeId: rangeAnchorNodeId,
      captureElement: event.currentTarget,
      viewportElement,
      active: false,
    };
  }, [rangeAnchorNodeId, selectedNodeIds, viewportRef]);

  const handleBackgroundPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const clientPoint = { x: event.clientX, y: event.clientY };
    if (!session.active) {
      const movement = Math.hypot(clientPoint.x - session.startClientPoint.x, clientPoint.y - session.startClientPoint.y);
      if (movement < marqueeDragThreshold) {
        return;
      }

      session.active = true;
    }

    event.preventDefault();
    updatePreview(session, clientPoint);
  }, [updatePreview]);

  const handleBackgroundPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const clientPoint = { x: event.clientX, y: event.clientY };
    const isInsideViewport = isPointInsideViewportContent(clientPoint, session.viewportElement);
    const hitNodeIds = session.active ? getHitsAt(session, clientPoint).hitNodeIds : null;
    const completedSession = endSession(true);

    if (!completedSession) {
      return;
    }

    if (completedSession.active && hitNodeIds !== null) {
      onCommitMarquee(
        completedSession.mode,
        completedSession.baselineSelectedNodeIds,
        completedSession.baselineRangeAnchorNodeId,
        visibleNodeIds,
        hitNodeIds,
      );
      return;
    }

    if (isInsideViewport) {
      onClearSelection();
      completedSession.captureElement.focus({ preventScroll: true });
      return;
    }

  }, [endSession, getHitsAt, onClearSelection, onCommitMarquee, visibleNodeIds]);

  const cancelMarquee = useCallback(() => {
    if (sessionRef.current === null) {
      return;
    }

    suppressNextBackgroundClickRef.current = false;
    endSession(true);
  }, [endSession]);

  const handleBackgroundPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (sessionRef.current?.pointerId !== event.pointerId) {
      return;
    }

    suppressNextBackgroundClickRef.current = false;
    endSession(true);
  }, [endSession]);

  const handleBackgroundLostPointerCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (sessionRef.current?.pointerId !== event.pointerId) {
      return;
    }

    suppressNextBackgroundClickRef.current = false;
    endSession(false);
  }, [endSession]);

  const handleBackgroundClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (suppressNextBackgroundClickRef.current) {
      suppressNextBackgroundClickRef.current = false;
      return;
    }

    onClearSelection();
    event.currentTarget.focus({ preventScroll: true });
  }, [onClearSelection]);

  return {
    effectiveSelectedNodeIds: preview?.selectedNodeIds ?? selectedNodeIds,
    marqueeRect: preview?.rect ?? null,
    isMarqueeActive: preview !== null,
    cancelMarquee,
    handleBackgroundClick,
    handleBackgroundPointerDown,
    handleBackgroundPointerMove,
    handleBackgroundPointerUp,
    handleBackgroundPointerCancel,
    handleBackgroundLostPointerCapture,
  };
}
