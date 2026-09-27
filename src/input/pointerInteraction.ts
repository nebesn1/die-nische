import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

/** The KDE shell keeps long-press timing in one place so touch surfaces agree. */
export const TOUCH_LONG_PRESS_DELAY_MS = 500;
/** Measured in browser client pixels before any KDE logical-coordinate conversion. */
export const TOUCH_LONG_PRESS_MOVE_TOLERANCE = 8;

export type LongPressInfo = {
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId: number;
};

type PrimaryPointerLikeEvent = {
  readonly button: number;
  readonly isPrimary?: boolean;
};

export function isPrimaryPointerEvent(event: PrimaryPointerLikeEvent): boolean {
  return (event.button === 0 || event.button === -1) && event.isPrimary !== false;
}

export function isTouchLikePointer(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

type ActiveLongPress = LongPressInfo & {
  readonly startX: number;
  readonly startY: number;
  readonly captureElement: HTMLElement;
  fired: boolean;
};

type LongPressOptions = {
  readonly onLongPress: (info: LongPressInfo) => void;
  readonly delayMs?: number;
  readonly moveTolerance?: number;
  readonly enabled?: boolean;
};

/**
 * A small pointer-event state machine for shell surfaces. It deliberately does
 * not change touch-action or prevent the browser's normal short-tap click.
 */
export function useLongPress<T extends HTMLElement>({
  delayMs = TOUCH_LONG_PRESS_DELAY_MS,
  enabled = true,
  moveTolerance = TOUCH_LONG_PRESS_MOVE_TOLERANCE,
  onLongPress,
}: LongPressOptions) {
  const activeRef = useRef<ActiveLongPress | null>(null);
  const timerRef = useRef<number | null>(null);
  const nativeContextTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressNativeContextRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearNativeContextTimer = useCallback(() => {
    if (nativeContextTimerRef.current !== null) {
      window.clearTimeout(nativeContextTimerRef.current);
      nativeContextTimerRef.current = null;
    }
  }, []);

  const clearActive = useCallback((element?: HTMLElement | null) => {
    const active = activeRef.current;
    clearTimer();
    activeRef.current = null;

    const captureElement = element ?? active?.captureElement;
    if (
      active
      && typeof captureElement?.hasPointerCapture === "function"
      && typeof captureElement.releasePointerCapture === "function"
      && captureElement.hasPointerCapture(active.pointerId)
    ) {
      captureElement.releasePointerCapture(active.pointerId);
    }
  }, [clearTimer]);

  const cancel = useCallback(() => {
    clearActive();
  }, [clearActive]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<T>) => {
    if (!enabled) {
      clearActive(event.currentTarget);
      return;
    }

    if (!isTouchLikePointer(event.pointerType) || !isPrimaryPointerEvent(event)) {
      if (activeRef.current && event.pointerId !== activeRef.current.pointerId) {
        clearActive(event.currentTarget);
      }
      return;
    }

    if (activeRef.current && event.pointerId !== activeRef.current.pointerId) {
      // A second touch must cancel the pending gesture rather than starting a
      // competing timer. This keeps pinch/zoom out of long-press semantics.
      clearActive(event.currentTarget);
      return;
    }

    clearActive(event.currentTarget);
    const active: ActiveLongPress = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      captureElement: event.currentTarget,
      fired: false,
    };
    activeRef.current = active;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timerRef.current = window.setTimeout(() => {
      const current = activeRef.current;
      if (!current || current.pointerId !== active.pointerId) {
        return;
      }

      current.fired = true;
      suppressClickRef.current = true;
      suppressNativeContextRef.current = true;
      clearNativeContextTimer();
      nativeContextTimerRef.current = window.setTimeout(() => {
        suppressNativeContextRef.current = false;
        nativeContextTimerRef.current = null;
      }, delayMs * 2);
      onLongPressRef.current({
        clientX: current.clientX,
        clientY: current.clientY,
        pointerId: current.pointerId,
      });
    }, delayMs);
  }, [clearActive, clearNativeContextTimer, delayMs, enabled]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<T>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > moveTolerance) {
      clearActive(event.currentTarget);
    }
  }, [clearActive, moveTolerance]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<T>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    clearActive(event.currentTarget);
  }, [clearActive]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<T>) => {
    if (activeRef.current?.pointerId === event.pointerId) {
      clearActive(event.currentTarget);
    }
  }, [clearActive]);

  const handleLostPointerCapture = useCallback((event: ReactPointerEvent<T>) => {
    if (activeRef.current?.pointerId === event.pointerId) {
      clearActive(event.currentTarget);
    }
  }, [clearActive]);

  const consumeClick = useCallback((event: ReactMouseEvent<T>): boolean => {
    if (!suppressClickRef.current) {
      return false;
    }

    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  const consumeNativeContextMenu = useCallback((): boolean => {
    if (!suppressNativeContextRef.current) {
      return false;
    }

    suppressNativeContextRef.current = false;
    clearNativeContextTimer();
    return true;
  }, [clearNativeContextTimer]);

  useEffect(() => () => {
    clearActive();
    clearNativeContextTimer();
  }, [clearActive, clearNativeContextTimer]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onLostPointerCapture: handleLostPointerCapture,
    consumeClick,
    consumeNativeContextMenu,
    cancel,
  };
}

type TouchClickGuardState = {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
};

/** Prevents a horizontal/vertical touch pan from replaying a child button click. */
export function useTouchClickGuard<T extends HTMLElement>() {
  const activeRef = useRef<TouchClickGuardState | null>(null);
  const suppressClickRef = useRef(false);

  const clear = useCallback(() => {
    activeRef.current = null;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
    if (!isTouchLikePointer(event.pointerType) || !isPrimaryPointerEvent(event)) {
      if (activeRef.current && activeRef.current.pointerId !== event.pointerId) {
        clear();
      }
      return;
    }

    if (activeRef.current && activeRef.current.pointerId !== event.pointerId) {
      suppressClickRef.current = true;
      clear();
      return;
    }

    activeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }, [clear]);

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > TOUCH_LONG_PRESS_MOVE_TOLERANCE) {
      active.moved = true;
      suppressClickRef.current = true;
    }
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<T>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    if (active.moved) {
      suppressClickRef.current = true;
    }
    clear();
  }, [clear]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<T>) => {
    if (activeRef.current?.pointerId === event.pointerId) {
      clear();
    }
  }, [clear]);

  const consumeClick = useCallback((event: ReactMouseEvent<HTMLElement>): boolean => {
    if (!suppressClickRef.current) {
      return false;
    }

    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  useEffect(() => () => clear(), [clear]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, consumeClick };
}
