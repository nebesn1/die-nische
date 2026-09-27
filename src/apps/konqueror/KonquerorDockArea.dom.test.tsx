// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KonquerorDockArea } from "./KonquerorDockArea";
import type { KonquerorDockOrder } from "./konquerorDockLayout";

let container: HTMLDivElement;
let reactRoot: Root;
let capturedPointerId: number | null = null;
let originalSetPointerCapture: PropertyDescriptor | undefined;
let originalReleasePointerCapture: PropertyDescriptor | undefined;
let originalHasPointerCapture: PropertyDescriptor | undefined;

const rect = (left: number, top: number, right: number, bottom: number): DOMRect => ({
  x: left,
  y: top,
  width: right - left,
  height: bottom - top,
  top,
  right,
  bottom,
  left,
  toJSON: () => ({}),
}) as DOMRect;

const DockHarness = ({ initialOrder = "toolbar-location" }: { readonly initialOrder?: KonquerorDockOrder }) => {
  const [dockOrder, setDockOrder] = useState(initialOrder);
  const renderBand = (band: "toolbar" | "location", grip: ReactNode) => (
    <div className={`dock-test-band dock-test-band--${band}`} data-band={band}>
      {grip}
      <button type="button" aria-label={`${band} command`}>{band}</button>
    </div>
  );

  return (
    <KonquerorDockArea
      dockOrder={dockOrder}
      onDockOrderChange={setDockOrder}
      renderToolbar={(grip) => renderBand("toolbar", grip)}
      renderLocationBar={(grip) => renderBand("location", grip)}
    />
  );
};

const dispatchPointer = (
  target: HTMLElement,
  type: string,
  { button = 0, clientX = 20, clientY = 10, isPrimary = true, pointerId = 1 }: {
    readonly button?: number;
    readonly clientX?: number;
    readonly clientY?: number;
    readonly isPrimary?: boolean;
    readonly pointerId?: number;
  } = {},
) => {
  const event = new MouseEvent(type, { bubbles: true, button, clientX, clientY, cancelable: true });
  Object.defineProperties(event, {
    isPrimary: { value: isPrimary },
    pointerId: { value: pointerId },
  });
  act(() => target.dispatchEvent(event));
};

const getDockArea = (): HTMLElement => {
  const dockArea = container.querySelector<HTMLElement>(".konqueror-dock-area");
  if (!dockArea) throw new Error("Missing DockArea");
  return dockArea;
};

const getGrip = (band: "toolbar" | "location"): HTMLElement => {
  const grip = container.querySelector<HTMLElement>(`[data-konqueror-dock-grip='${band}']`);
  if (!grip) throw new Error(`Missing ${band} grip`);
  return grip;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  capturedPointerId = null;
  originalSetPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
  originalReleasePointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "releasePointerCapture");
  originalHasPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hasPointerCapture");
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: (pointerId: number) => { capturedPointerId = pointerId; },
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: (pointerId: number) => {
      if (capturedPointerId === pointerId) capturedPointerId = null;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerId === pointerId,
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("konqueror-dock-area")) return rect(0, 0, 240, 60);
    if (this.dataset.konquerorDockSlot === "1") return rect(0, 0, 240, 30);
    if (this.dataset.konquerorDockSlot === "2") return rect(0, 30, 240, 60);
    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
  if (originalSetPointerCapture) Object.defineProperty(HTMLElement.prototype, "setPointerCapture", originalSetPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
  if (originalReleasePointerCapture) Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", originalReleasePointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture;
  if (originalHasPointerCapture) Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", originalHasPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).hasPointerCapture;
});

describe("KonquerorDockArea", () => {
  it("commits Toolbar and Location drags in either direction with pointer capture", () => {
    act(() => reactRoot.render(<DockHarness />));
    const toolbarGrip = getGrip("toolbar");

    dispatchPointer(toolbarGrip, "pointerdown", { clientY: 10 });
    expect(capturedPointerId).toBe(1);
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("location-toolbar");
    expect(getDockArea().dataset.dockDragging).toBe("true");
    dispatchPointer(toolbarGrip, "pointerup", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("location-toolbar");
    expect(capturedPointerId).toBeNull();

    const locationGrip = getGrip("location");
    dispatchPointer(locationGrip, "pointerdown", { clientY: 10 });
    dispatchPointer(locationGrip, "pointermove", { clientY: 45 });
    dispatchPointer(locationGrip, "pointerup", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");
  });

  it("ignores non-primary drags and movement below the fixed threshold", () => {
    act(() => reactRoot.render(<DockHarness />));
    const toolbarGrip = getGrip("toolbar");

    dispatchPointer(toolbarGrip, "pointerdown", { button: 2 });
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");

    dispatchPointer(toolbarGrip, "pointerdown", { button: 1 });
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");

    dispatchPointer(toolbarGrip, "pointerdown", { clientY: 10 });
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 13 });
    dispatchPointer(toolbarGrip, "pointerup", { clientY: 13 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");
    expect(getDockArea().dataset.dockDragging).toBe("false");
  });

  it("cancels outside drops, pointer cancellation, and lost capture without a stuck preview", () => {
    act(() => reactRoot.render(<DockHarness />));
    const toolbarGrip = getGrip("toolbar");

    dispatchPointer(toolbarGrip, "pointerdown", { clientY: 10 });
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 45 });
    dispatchPointer(toolbarGrip, "pointermove", { clientX: 300, clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");
    dispatchPointer(toolbarGrip, "pointerup", { clientX: 300, clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");

    dispatchPointer(toolbarGrip, "pointerdown", { clientY: 10 });
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 45 });
    dispatchPointer(toolbarGrip, "pointercancel", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");
    expect(getDockArea().dataset.dockDragging).toBe("false");

    dispatchPointer(toolbarGrip, "pointerdown", { clientY: 10 });
    dispatchPointer(toolbarGrip, "pointermove", { clientY: 45 });
    dispatchPointer(toolbarGrip, "lostpointercapture", { clientY: 45 });
    expect(getDockArea().dataset.dockOrder).toBe("toolbar-location");
    expect(getDockArea().dataset.dockDragging).toBe("false");
  });
});
