import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import {
  getDesktopLogicalItemRect,
  getDesktopLogicalPoint,
  getDesktopMarqueeHitIconIds,
  getNormalizedDesktopMarqueeRect,
  type DesktopMarqueePoint,
  type DesktopMarqueeRect,
} from "./desktopMarqueeSelection";
import { toLogicalRect } from "./desktopUiScale";

type DesktopMarqueeSession = {
  readonly pointerId: number;
  readonly startPoint: DesktopMarqueePoint;
  readonly startClientPoint: DesktopMarqueePoint;
  readonly captureElement: HTMLElement;
  readonly desktopElement: HTMLElement;
  readonly baselineSelectedIconIds: readonly string[];
  readonly addToSelection: boolean;
  active: boolean;
};

type DesktopMarqueePreview = {
  readonly rect: DesktopMarqueeRect;
  readonly selectedIconIds: readonly string[];
};

type UseDesktopMarqueeSelectionOptions = {
  readonly desktopRef: RefObject<HTMLElement | null>;
  readonly visibleIconIds: readonly string[];
  readonly selectedIconIds: readonly string[];
  readonly onClearSelection: () => void;
  readonly onCommitSelection: (iconIds: readonly string[]) => void;
};

const marqueeDragThreshold = 4;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

const getDesktopBounds = (desktopElement: HTMLElement) => {
  const rect = toLogicalRect(desktopElement.getBoundingClientRect());
  return {
    rect,
    width: desktopElement.clientWidth > 0 ? desktopElement.clientWidth : rect.width,
    height: desktopElement.clientHeight > 0 ? desktopElement.clientHeight : rect.height,
  };
};

const getDesktopPoint = (clientPoint: DesktopMarqueePoint, desktopElement: HTMLElement): DesktopMarqueePoint => {
  const bounds = getDesktopBounds(desktopElement);
  const point = getDesktopLogicalPoint(clientPoint, desktopElement.getBoundingClientRect());
  return {
    x: clamp(point.x, 0, bounds.width),
    y: clamp(point.y, 0, bounds.height),
  };
};

const isPointInsideDesktop = (clientPoint: DesktopMarqueePoint, desktopElement: HTMLElement): boolean => {
  const bounds = getDesktopBounds(desktopElement);
  const point = getDesktopLogicalPoint(clientPoint, desktopElement.getBoundingClientRect());
  return point.x >= 0 && point.x < bounds.width && point.y >= 0 && point.y < bounds.height;
};

const getDesktopIconRects = (desktopElement: HTMLElement): ReadonlyMap<string, DesktopMarqueeRect> => {
  const desktopRect = desktopElement.getBoundingClientRect();
  const itemRects = new Map<string, DesktopMarqueeRect>();

  for (const item of desktopElement.querySelectorAll<HTMLElement>("[data-desktop-icon-id]")) {
    const iconId = item.dataset.desktopIconId;
    if (!iconId) continue;
    itemRects.set(iconId, getDesktopLogicalItemRect(item.getBoundingClientRect(), desktopRect));
  }

  return itemRects;
};

export function useDesktopMarqueeSelection({
  desktopRef,
  visibleIconIds,
  selectedIconIds,
  onClearSelection,
  onCommitSelection,
}: UseDesktopMarqueeSelectionOptions) {
  const sessionRef = useRef<DesktopMarqueeSession | null>(null);
  const suppressNextBackgroundClickRef = useRef(false);
  const [preview, setPreview] = useState<DesktopMarqueePreview | null>(null);

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

  const getHitsAt = useCallback((session: DesktopMarqueeSession, clientPoint: DesktopMarqueePoint) => {
    const rect = getNormalizedDesktopMarqueeRect(
      session.startPoint,
      getDesktopPoint(clientPoint, session.desktopElement),
    );
    const hitIconIds = getDesktopMarqueeHitIconIds(
      visibleIconIds,
      rect,
      getDesktopIconRects(session.desktopElement),
    );
    return { rect, hitIconIds };
  }, [visibleIconIds]);

  const updatePreview = useCallback((session: DesktopMarqueeSession, clientPoint: DesktopMarqueePoint) => {
    const { rect, hitIconIds } = getHitsAt(session, clientPoint);
    const selected = session.addToSelection
      ? [...new Set([...session.baselineSelectedIconIds, ...hitIconIds])]
      : hitIconIds;
    setPreview({ rect, selectedIconIds: selected });
    return hitIconIds;
  }, [getHitsAt]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.button !== 0 || !event.isPrimary) return;

    const desktopElement = desktopRef.current;
    if (!desktopElement || !isPointInsideDesktop({ x: event.clientX, y: event.clientY }, desktopElement)) return;

    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    suppressNextBackgroundClickRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startClientPoint = { x: event.clientX, y: event.clientY };
    sessionRef.current = {
      pointerId: event.pointerId,
      startPoint: getDesktopPoint(startClientPoint, desktopElement),
      startClientPoint,
      captureElement: event.currentTarget,
      desktopElement,
      baselineSelectedIconIds: selectedIconIds,
      addToSelection: event.ctrlKey,
      active: false,
    };
  }, [desktopRef, selectedIconIds]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const point = { x: event.clientX, y: event.clientY };
    const logicalStart = getDesktopPoint(session.startClientPoint, session.desktopElement);
    const logicalCurrent = getDesktopPoint(point, session.desktopElement);
    if (!session.active) {
      if (Math.hypot(logicalCurrent.x - logicalStart.x, logicalCurrent.y - logicalStart.y) < marqueeDragThreshold) return;
      session.active = true;
    }

    event.preventDefault();
    updatePreview(session, point);
  }, [updatePreview]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const point = { x: event.clientX, y: event.clientY };
    const hitIconIds = session.active ? getHitsAt(session, point).hitIconIds : null;
    const isInside = isPointInsideDesktop(point, session.desktopElement);
    const completed = endSession(true);
    if (!completed) return;

    if (completed.active && hitIconIds !== null) {
      onCommitSelection(completed.addToSelection
        ? [...new Set([...completed.baselineSelectedIconIds, ...hitIconIds])]
        : hitIconIds);
      return;
    }

    if (isInside) {
      onClearSelection();
      completed.captureElement.focus({ preventScroll: true });
    }
  }, [endSession, getHitsAt, onClearSelection, onCommitSelection]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    suppressNextBackgroundClickRef.current = false;
    endSession(true);
  }, [endSession]);

  const handleLostPointerCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    suppressNextBackgroundClickRef.current = false;
    endSession(false);
  }, [endSession]);

  const handleBackgroundClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (suppressNextBackgroundClickRef.current) {
      suppressNextBackgroundClickRef.current = false;
      return;
    }
    onClearSelection();
    event.currentTarget.focus({ preventScroll: true });
  }, [onClearSelection]);

  return {
    effectiveSelectedIconIds: preview?.selectedIconIds ?? selectedIconIds,
    marqueeRect: preview?.rect ?? null,
    isMarqueeActive: preview !== null,
    handleBackgroundClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
  };
}
