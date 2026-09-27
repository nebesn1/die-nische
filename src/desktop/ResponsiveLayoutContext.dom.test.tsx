// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponsiveLayoutProvider } from "./ResponsiveLayoutContext";
import { useResponsiveLayout } from "./responsiveLayoutContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ResponsiveProbe() {
  const layout = useResponsiveLayout();
  const [count, setCount] = useState(0);

  return (
    <button
      type="button"
      data-layout-mode={layout.layoutMode}
      data-orientation={layout.orientation}
      data-count={count}
      data-logical-viewport-height={layout.logicalViewportHeight.toString()}
      data-logical-work-area-height={layout.logicalWorkAreaHeight.toString()}
      onClick={() => setCount((current) => current + 1)}
    >
      {layout.logicalViewportWidth}
    </button>
  );
}

const makeRect = (width: number, height: number): DOMRect => ({
  bottom: height,
  height,
  left: 0,
  right: width,
  top: 0,
  width,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect);

describe("ResponsiveLayoutProvider", () => {
  let container: HTMLDivElement;
  let root: Root;
  let rootViewport: { width: number; height: number };
  let frameCallbacks: FrameRequestCallback[];
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined;
  let originalCancelAnimationFrame: typeof window.cancelAnimationFrame | undefined;
  let originalInnerWidth: PropertyDescriptor | undefined;
  let originalInnerHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "root";
    document.body.append(container);
    root = createRoot(container);
    rootViewport = { width: 390, height: 844 };
    vi.spyOn(container, "getBoundingClientRect").mockImplementation(() => makeRect(rootViewport.width, rootViewport.height));
    frameCallbacks = [];
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
    originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: () => undefined,
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: (property: string) => ({
        "--kde-ui-scale": "1.4",
        "--kde-panel-height": "46px",
        "--kde-titlebar-height": "22px",
        "--kde-safe-area-inset-top": "28px",
        "--kde-safe-area-inset-right": "0px",
        "--kde-safe-area-inset-bottom": "42px",
        "--kde-safe-area-inset-left": "0px",
      }[property] ?? ""),
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalRequestAnimationFrame) {
      Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: originalRequestAnimationFrame });
    } else {
      delete (window as Partial<Window>).requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: originalCancelAnimationFrame });
    } else {
      delete (window as Partial<Window>).cancelAnimationFrame;
    }
    if (originalInnerWidth) Object.defineProperty(window, "innerWidth", originalInnerWidth);
    if (originalInnerHeight) Object.defineProperty(window, "innerHeight", originalInnerHeight);
    vi.restoreAllMocks();
  });

  it("publishes live mode/orientation and preserves the mounted consumer through resize", () => {
    act(() => root.render(
      <ResponsiveLayoutProvider>
        <ResponsiveProbe />
      </ResponsiveLayoutProvider>,
    ));

    const probe = container.querySelector("button");
    expect(probe?.dataset.layoutMode).toBe("mobile");
    expect(probe?.dataset.orientation).toBe("portrait");
    act(() => probe?.click());
    expect(probe?.dataset.count).toBe("1");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    rootViewport = { width: 1024, height: 768 };
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => frameCallbacks.splice(0).forEach((callback) => callback(0)));

    expect(container.querySelector("button")).toBe(probe);
    expect(probe?.dataset.layoutMode).toBe("desktop");
    expect(probe?.dataset.orientation).toBe("landscape");
    expect(probe?.dataset.count).toBe("1");
  });

  it("deduplicates window and visualViewport resize notifications into one refresh frame", () => {
    act(() => root.render(
      <ResponsiveLayoutProvider>
        <ResponsiveProbe />
      </ResponsiveLayoutProvider>,
    ));

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));
    });

    expect(frameCallbacks).toHaveLength(1);
  });

  it("updates from root ResizeObserver geometry when window.innerHeight is stale", () => {
    type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;
    let resizeObserverCallback: ResizeObserverCallback | null = null;
    const disconnect = vi.fn();
    const observe = vi.fn();
    const ResizeObserverMock = class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      disconnect = disconnect;
      observe = observe;
      unobserve = vi.fn();
    } as unknown as ResizeObserverConstructor;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    act(() => root.render(
      <ResponsiveLayoutProvider>
        <ResponsiveProbe />
      </ResponsiveLayoutProvider>,
    ));

    const probe = container.querySelector("button");
    expect(probe?.dataset.layoutMode).toBe("mobile");
    expect(probe?.dataset.orientation).toBe("portrait");
    act(() => probe?.click());
    expect(probe?.dataset.count).toBe("1");
    expect(observe).toHaveBeenCalledWith(container);

    rootViewport = { width: 390, height: 720 };
    act(() => resizeObserverCallback?.([], {} as ResizeObserver));
    expect(frameCallbacks).toHaveLength(1);
    act(() => frameCallbacks.splice(0).forEach((callback) => callback(0)));

    expect(probe?.dataset.layoutMode).toBe("mobile");
    expect(probe?.dataset.orientation).toBe("portrait");
    expect(container.querySelector("button")).toBe(probe);
    expect(probe?.dataset.count).toBe("1");
    expect(Number(probe?.textContent)).toBeCloseTo(390 / 1.4);
    expect(Number(probe?.dataset.logicalViewportHeight)).toBeCloseTo(720 / 1.4);
    expect(Number(probe?.dataset.logicalWorkAreaHeight)).toBeCloseTo(720 / 1.4 - 46);
    expect(disconnect).not.toHaveBeenCalled();

    rootViewport = { width: 844, height: 390 };
    act(() => resizeObserverCallback?.([], {} as ResizeObserver));
    act(() => frameCallbacks.splice(0).forEach((callback) => callback(0)));
    expect(probe?.dataset.layoutMode).toBe("desktop");
    expect(probe?.dataset.orientation).toBe("landscape");
    expect(Number(probe?.dataset.logicalViewportHeight)).toBeCloseTo(390 / 1.4);

    act(() => root.unmount());
    expect(disconnect).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("uses the applied shell zoom and publishes the same logical geometry to CSS", () => {
    rootViewport = { width: 1920, height: 1080 };
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1080 });
    vi.mocked(window.getComputedStyle).mockImplementation((element) => ({
      zoom: element instanceof Element && element.classList.contains("desktop-shell") ? "1.40625" : "",
      getPropertyValue: (property: string) => ({
        "--kde-ui-scale": "1.4",
        zoom: element instanceof Element && element.classList.contains("desktop-shell") ? "1.40625" : "",
        "--kde-panel-height": "46px",
        "--kde-titlebar-height": "22px",
        "--kde-safe-area-inset-top": "0px",
        "--kde-safe-area-inset-right": "0px",
        "--kde-safe-area-inset-bottom": "0px",
        "--kde-safe-area-inset-left": "0px",
      }[property] ?? ""),
    } as CSSStyleDeclaration));

    act(() => root.render(
      <ResponsiveLayoutProvider>
        <>
          <main className="desktop-shell" />
          <ResponsiveProbe />
        </>
      </ResponsiveLayoutProvider>,
    ));

    const probe = container.querySelector("button");
    const expectedWidth = 1920 / 1.40625;
    const expectedHeight = 1080 / 1.40625;
    expect(Number(probe?.textContent)).toBeCloseTo(expectedWidth);
    expect(Number(probe?.dataset.logicalViewportHeight)).toBeCloseTo(expectedHeight);
    expect(document.documentElement.style.getPropertyValue("--kde-effective-ui-scale")).toBe("1.40625");
    expect(document.documentElement.style.getPropertyValue("--kde-logical-viewport-width")).toBe(`${expectedWidth}px`);
    expect(document.documentElement.style.getPropertyValue("--kde-logical-viewport-height")).toBe(`${expectedHeight}px`);
    expect(document.documentElement.style.getPropertyValue("--kde-logical-work-area-height")).toBe(`${expectedHeight - 46}px`);
  });

  it("coalesces window, visual viewport, and root resize invalidations", () => {
    type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;
    let resizeObserverCallback: ResizeObserverCallback | null = null;
    const ResizeObserverMock = class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    } as unknown as ResizeObserverConstructor;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    act(() => root.render(
      <ResponsiveLayoutProvider>
        <ResponsiveProbe />
      </ResponsiveLayoutProvider>,
    ));

    act(() => {
      window.dispatchEvent(new Event("resize"));
      window.visualViewport?.dispatchEvent(new Event("resize"));
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(frameCallbacks).toHaveLength(1);
  });
});
