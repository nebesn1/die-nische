import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { VfsNodeId } from "../../vfs/types";
import {
  isPrimaryPointerEvent,
  isTouchLikePointer,
  TOUCH_LONG_PRESS_MOVE_TOLERANCE,
  useLongPress,
} from "../../input/pointerInteraction";
import { isKonquerorNodeSelected, type KonquerorSelectedNodeIds } from "./selectionModel";

type TouchResourceTarget = {
  readonly pointerId: number;
  readonly nodeId: VfsNodeId | null;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
  longPressed: boolean;
};

type UseKonquerorTouchResourceInteractionOptions = {
  readonly enabled: boolean;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly onSelectNode: (nodeId: VfsNodeId, intent: "replace") => void;
  readonly onOpenNode: (nodeId: VfsNodeId) => void;
  readonly onOpenItemContextMenu: (nodeId: VfsNodeId, clientX: number, clientY: number) => void;
  readonly onOpenBackgroundContextMenu: (clientX: number, clientY: number) => void;
};

const getTouchTargetNodeId = (target: EventTarget | null): VfsNodeId | null => {
  if (!(target instanceof Element) || target.closest(".konqueror-tree-expander") !== null) {
    return null;
  }

  return target.closest<HTMLElement>("[data-konqueror-node-id]")?.dataset.konquerorNodeId as VfsNodeId | undefined ?? null;
};

/** Adds mobile-only select/open/long-press semantics to an existing resource view. */
export function useKonquerorTouchResourceInteraction({
  enabled,
  onOpenBackgroundContextMenu,
  onOpenItemContextMenu,
  onOpenNode,
  onSelectNode,
  selectedNodeIds,
}: UseKonquerorTouchResourceInteractionOptions) {
  const targetRef = useRef<TouchResourceTarget | null>(null);
  const suppressClickRef = useRef(false);
  const longPress = useLongPress<HTMLElement>({
    enabled,
    onLongPress: ({ clientX, clientY }) => {
      const target = targetRef.current;
      if (!target) {
        return;
      }

      target.longPressed = true;
      if (target.nodeId !== null) {
        onOpenItemContextMenu(target.nodeId, clientX, clientY);
      } else {
        onOpenBackgroundContextMenu(clientX, clientY);
      }
    },
  });

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || !isTouchLikePointer(event.pointerType) || !isPrimaryPointerEvent(event)) {
      if (targetRef.current && targetRef.current.pointerId !== event.pointerId) {
        targetRef.current = null;
        longPress.cancel();
      }
      return;
    }

    if (targetRef.current && targetRef.current.pointerId !== event.pointerId) {
      targetRef.current = null;
      longPress.cancel();
      return;
    }

    targetRef.current = {
      pointerId: event.pointerId,
      nodeId: getTouchTargetNodeId(event.target),
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      longPressed: false,
    };
    longPress.onPointerDown(event);
  }, [enabled, longPress]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const target = targetRef.current;
    if (!target || target.pointerId !== event.pointerId) {
      return;
    }

    if (Math.hypot(event.clientX - target.startX, event.clientY - target.startY) > TOUCH_LONG_PRESS_MOVE_TOLERANCE) {
      target.moved = true;
    }
    longPress.onPointerMove(event);
  }, [longPress]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const target = targetRef.current;
    if (!target || target.pointerId !== event.pointerId) {
      return;
    }

    longPress.onPointerUp(event);
    targetRef.current = null;
    if (target.moved) {
      // A scroll gesture must not synthesize a later item activation click.
      suppressClickRef.current = true;
      event.preventDefault();
      return;
    }

    if (!target.longPressed && target.nodeId !== null) {
      event.preventDefault();
      suppressClickRef.current = true;
      if (isKonquerorNodeSelected(selectedNodeIds, target.nodeId)) {
        onOpenNode(target.nodeId);
      } else {
        onSelectNode(target.nodeId, "replace");
      }
    }
  }, [longPress, onOpenNode, onSelectNode, selectedNodeIds]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (targetRef.current?.pointerId === event.pointerId) {
      targetRef.current = null;
    }
    longPress.onPointerCancel(event);
  }, [longPress]);

  const onLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (targetRef.current?.pointerId === event.pointerId) {
      targetRef.current = null;
    }
    longPress.onLostPointerCapture(event);
  }, [longPress]);

  const consumeClick = useCallback((event: ReactMouseEvent<HTMLElement>): boolean => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return longPress.consumeClick(event);
  }, [longPress]);
  const consumeNativeContextMenu = useCallback(() => longPress.consumeNativeContextMenu(), [longPress]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    consumeClick,
    consumeNativeContextMenu,
  };
}
