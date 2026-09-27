// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopMarqueeSelection } from "./useDesktopMarqueeSelection";

type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; readonly width: number; readonly height: number };

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});

function DesktopMarqueeHarness() {
  const desktopRef = useRef<HTMLElement | null>(null);
  const [selectedIconIds, setSelectedIconIds] = useState<readonly string[]>([]);
  const marquee = useDesktopMarqueeSelection({
    desktopRef,
    visibleIconIds: ["first", "second"],
    selectedIconIds,
    onClearSelection: () => setSelectedIconIds([]),
    onCommitSelection: (iconIds) => setSelectedIconIds(iconIds),
  });

  return (
    <main ref={desktopRef} data-selected={selectedIconIds.join(",")} data-preview-selected={marquee.effectiveSelectedIconIds.join(",")}>
      <section
        aria-label="Desktop background"
        onClick={marquee.handleBackgroundClick}
        onLostPointerCapture={marquee.handleLostPointerCapture}
        onPointerCancel={marquee.handlePointerCancel}
        onPointerDown={marquee.handlePointerDown}
        onPointerMove={marquee.handlePointerMove}
        onPointerUp={marquee.handlePointerUp}
      >
        <button data-desktop-icon-id="first" type="button">First</button>
        <button data-desktop-icon-id="second" type="button">Second</button>
        {marquee.marqueeRect ? <div className="desktop-selection-marquee" style={{ left: marquee.marqueeRect.left, top: marquee.marqueeRect.top, width: marquee.marqueeRect.width, height: marquee.marqueeRect.height }} /> : null}
      </section>
    </main>
  );
}

const dispatchPointer = (element: HTMLElement, type: string, pointerId: number, clientX: number, clientY: number): void => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY });
  Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: true } });
  act(() => element.dispatchEvent(event));
};

describe("Desktop marquee selection", () => {
  let container: HTMLDivElement;
  let root: Root;
  let capturedPointerIds: Set<number>;
  let originalSetPointerCapture: PropertyDescriptor | undefined;
  let originalReleasePointerCapture: PropertyDescriptor | undefined;
  let originalHasPointerCapture: PropertyDescriptor | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as CSSStyleDeclaration));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    capturedPointerIds = new Set();
    originalSetPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
    originalReleasePointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "releasePointerCapture");
    originalHasPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hasPointerCapture");
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.add(pointerId) });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.delete(pointerId) });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.has(pointerId) });
    act(() => root.render(<DesktopMarqueeHarness />));

    const desktop = container.querySelector("main");
    const first = container.querySelector<HTMLElement>('[data-desktop-icon-id="first"]');
    const second = container.querySelector<HTMLElement>('[data-desktop-icon-id="second"]');
    if (!desktop || !first || !second) throw new Error("Missing desktop marquee harness");
    vi.spyOn(desktop, "getBoundingClientRect").mockReturnValue(rect(0, 0, 700, 700) as DOMRect);
    Object.defineProperty(desktop, "clientWidth", { configurable: true, value: 500 });
    Object.defineProperty(desktop, "clientHeight", { configurable: true, value: 500 });
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue(rect(140, 140, 280, 280) as DOMRect);
    vi.spyOn(second, "getBoundingClientRect").mockReturnValue(rect(420, 140, 560, 280) as DOMRect);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalSetPointerCapture) Object.defineProperty(HTMLElement.prototype, "setPointerCapture", originalSetPointerCapture);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
    if (originalReleasePointerCapture) Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", originalReleasePointerCapture);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture;
    if (originalHasPointerCapture) Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", originalHasPointerCapture);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).hasPointerCapture;
    vi.restoreAllMocks();
  });

  it("renders a scaled marquee and commits the icons intersecting that same rectangle", () => {
    const surface = container.querySelector("section");
    if (!surface) throw new Error("Missing desktop surface");

    dispatchPointer(surface, "pointerdown", 1, 70, 70);
    dispatchPointer(surface, "pointermove", 1, 350, 210);

    const marquee = container.querySelector<HTMLElement>(".desktop-selection-marquee");
    expect(marquee).not.toBeNull();
    expect(marquee?.style.left).toBe("50px");
    expect(marquee?.style.top).toBe("50px");
    expect(Number.parseFloat(marquee?.style.width ?? "0")).toBeCloseTo(200);
    expect(Number.parseFloat(marquee?.style.height ?? "0")).toBeCloseTo(100);
    expect(container.querySelector("main")?.getAttribute("data-preview-selected")).toBe("first");

    dispatchPointer(surface, "pointerup", 1, 350, 210);
    expect(container.querySelector("main")?.getAttribute("data-selected")).toBe("first");
    expect(container.querySelector(".desktop-selection-marquee")).toBeNull();
  });
});
