// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext } from "../i18n/I18nContext";
import { createTranslator } from "../i18n/translate";
import { DesktopBackgroundSurface } from "./DesktopBackgroundSurface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const createPointerEvent = (type: string) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: 112 },
    clientY: { value: 86 },
    isPrimary: { value: true },
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
  });
  return event;
};

const renderSurface = (onOpenContextMenu: ReturnType<typeof vi.fn>) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(
    <I18nContext.Provider value={{ locale: "en", t: createTranslator("en") }}>
      <DesktopBackgroundSurface onClearSelection={vi.fn()} onOpenContextMenu={onOpenContextMenu} />
    </I18nContext.Provider>,
  ));
  const surface = container.querySelector<HTMLElement>(".desktop-background-surface");
  if (!surface) throw new Error("Desktop background surface missing");
  return surface;
};

const tap = (surface: HTMLElement) => {
  act(() => surface.dispatchEvent(createPointerEvent("pointerdown")));
  act(() => surface.dispatchEvent(createPointerEvent("pointerup")));
  act(() => surface.click());
};

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("DesktopBackgroundSurface touch interaction", () => {
  it("does not open a context menu for a short touch tap", () => {
    const onOpenContextMenu = vi.fn();
    const surface = renderSurface(onOpenContextMenu);

    tap(surface);

    expect(onOpenContextMenu).not.toHaveBeenCalled();
  });

  it("opens the existing background context-menu boundary once for a long press and suppresses ghost input", () => {
    vi.useFakeTimers();
    const onOpenContextMenu = vi.fn();
    const surface = renderSurface(onOpenContextMenu);

    act(() => surface.dispatchEvent(createPointerEvent("pointerdown")));
    act(() => vi.advanceTimersByTime(500));
    expect(onOpenContextMenu).toHaveBeenCalledWith(112, 86);

    act(() => surface.dispatchEvent(createPointerEvent("pointerup")));
    act(() => surface.click());
    expect(onOpenContextMenu).toHaveBeenCalledTimes(1);
  });
});
