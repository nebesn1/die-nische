// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPrimaryPointerEvent,
  TOUCH_LONG_PRESS_DELAY_MS,
  TOUCH_LONG_PRESS_MOVE_TOLERANCE,
  useLongPress,
} from "./pointerInteraction";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const createPointerEvent = (type: string, {
  clientX = 10,
  clientY = 20,
  pointerId = 1,
  pointerType = "touch",
  isPrimary = true,
  button = 0,
}: Partial<PointerEventInit> & { button?: number } = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: button },
    clientX: { value: clientX },
    clientY: { value: clientY },
    isPrimary: { value: isPrimary },
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  return event;
};

function LongPressProbe({ onLongPress }: { onLongPress: (info: { clientX: number; clientY: number }) => void }) {
  const longPress = useLongPress<HTMLDivElement>({ onLongPress });

  return (
    <div
      data-probe
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onLostPointerCapture={longPress.onLostPointerCapture}
      onClick={longPress.consumeClick}
      onContextMenu={(event) => {
        if (longPress.consumeNativeContextMenu()) {
          event.preventDefault();
        }
      }}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("pointer interaction foundation", () => {
  it("accepts primary mouse and touch pointerdown button conventions but rejects secondary pointers", () => {
    expect(isPrimaryPointerEvent({ button: 0, isPrimary: true })).toBe(true);
    expect(isPrimaryPointerEvent({ button: -1, isPrimary: true })).toBe(true);
    expect(isPrimaryPointerEvent({ button: 0, isPrimary: false })).toBe(false);
    expect(isPrimaryPointerEvent({ button: 2, isPrimary: true })).toBe(false);
  });

  it("fires a 500ms touch long press, then suppresses the synthetic click/context menu", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<LongPressProbe onLongPress={onLongPress} />));
    const probe = container.querySelector<HTMLElement>("[data-probe]")!;

    act(() => probe.dispatchEvent(createPointerEvent("pointerdown", { clientX: 32, clientY: 44 })));
    act(() => vi.advanceTimersByTime(TOUCH_LONG_PRESS_DELAY_MS - 1));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledWith({ clientX: 32, clientY: 44, pointerId: 1 });

    act(() => probe.dispatchEvent(createPointerEvent("pointerup")));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => probe.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);

    const contextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    act(() => probe.dispatchEvent(contextMenu));
    expect(contextMenu.defaultPrevented).toBe(true);
  });

  it("cancels on movement beyond the client-pixel tolerance, pointercancel, and unmount", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<LongPressProbe onLongPress={onLongPress} />));
    const probe = container.querySelector<HTMLElement>("[data-probe]")!;

    act(() => probe.dispatchEvent(createPointerEvent("pointerdown", { clientX: 10, clientY: 10 })));
    act(() => probe.dispatchEvent(createPointerEvent("pointermove", {
      clientX: 10 + TOUCH_LONG_PRESS_MOVE_TOLERANCE + 1,
      clientY: 10,
    })));
    act(() => vi.advanceTimersByTime(TOUCH_LONG_PRESS_DELAY_MS));
    expect(onLongPress).not.toHaveBeenCalled();

    onLongPress.mockClear();
    act(() => probe.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 2 })));
    act(() => probe.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 3 })));
    act(() => vi.advanceTimersByTime(TOUCH_LONG_PRESS_DELAY_MS));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => probe.dispatchEvent(createPointerEvent("pointerdown", { pointerId: 4 })));
    act(() => probe.dispatchEvent(createPointerEvent("pointercancel", { pointerId: 4 })));
    act(() => root?.unmount());
    act(() => vi.advanceTimersByTime(TOUCH_LONG_PRESS_DELAY_MS));
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
