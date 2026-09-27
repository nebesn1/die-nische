// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKonquerorTouchResourceInteraction } from "./useKonquerorTouchResourceInteraction";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const createPointerEvent = (
  type: string,
  {
    clientX = 32,
    clientY = 44,
    pointerId = 1,
    pointerType = "touch",
  }: { readonly clientX?: number; readonly clientY?: number; readonly pointerId?: number; readonly pointerType?: string } = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    isPrimary: { value: true },
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  return event;
};

function ResourceHarness({
  onOpenBackgroundContextMenu,
  onOpenItemContextMenu,
  onOpenNode,
}: {
  readonly onOpenBackgroundContextMenu: ReturnType<typeof vi.fn>;
  readonly onOpenItemContextMenu: ReturnType<typeof vi.fn>;
  readonly onOpenNode: ReturnType<typeof vi.fn>;
}) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<readonly string[]>([]);
  const touch = useKonquerorTouchResourceInteraction({
    enabled: true,
    selectedNodeIds,
    onSelectNode: (nodeId) => setSelectedNodeIds([nodeId]),
    onOpenNode,
    onOpenItemContextMenu,
    onOpenBackgroundContextMenu,
  });

  return (
    <div
      data-resource-surface
      onPointerDown={touch.onPointerDown}
      onPointerMove={touch.onPointerMove}
      onPointerUp={touch.onPointerUp}
      onPointerCancel={touch.onPointerCancel}
      onLostPointerCapture={touch.onLostPointerCapture}
      onClick={(event) => { touch.consumeClick(event); }}
      onContextMenu={(event) => { if (touch.consumeNativeContextMenu()) event.preventDefault(); }}
    >
      <button type="button" data-konqueror-node-id="node-a" aria-selected={selectedNodeIds.includes("node-a")}>
        A
      </button>
      <button type="button" data-konqueror-node-id="node-b" aria-selected={selectedNodeIds.includes("node-b")}>
        B
      </button>
    </div>
  );
}

const renderHarness = (
  onOpenBackgroundContextMenu: ReturnType<typeof vi.fn>,
  onOpenItemContextMenu: ReturnType<typeof vi.fn>,
  onOpenNode: ReturnType<typeof vi.fn>,
) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(
    <ResourceHarness
      onOpenBackgroundContextMenu={onOpenBackgroundContextMenu}
      onOpenItemContextMenu={onOpenItemContextMenu}
      onOpenNode={onOpenNode}
    />,
  ));
  const surface = container.querySelector<HTMLElement>('[data-resource-surface="true"]') ?? container.querySelector<HTMLElement>('[data-resource-surface]');
  const item = container.querySelector<HTMLButtonElement>('[data-konqueror-node-id="node-a"]');
  const secondItem = container.querySelector<HTMLButtonElement>('[data-konqueror-node-id="node-b"]');
  if (!surface || !item || !secondItem) throw new Error("Touch resource harness missing");
  return { item, secondItem, surface };
};

const tap = (item: HTMLButtonElement, pointerId: number) => {
  act(() => item.dispatchEvent(createPointerEvent("pointerdown", { pointerId })));
  act(() => item.dispatchEvent(createPointerEvent("pointerup", { pointerId })));
  act(() => item.click());
};

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("Konqueror mobile resource touch interaction", () => {
  it("selects on the first tap and opens the selected item on the second tap", () => {
    const onOpenBackgroundContextMenu = vi.fn();
    const onOpenItemContextMenu = vi.fn();
    const onOpenNode = vi.fn();
    const { item } = renderHarness(onOpenBackgroundContextMenu, onOpenItemContextMenu, onOpenNode);

    tap(item, 1);
    expect(item.getAttribute("aria-selected")).toBe("true");
    expect(onOpenNode).not.toHaveBeenCalled();

    tap(item, 2);
    expect(onOpenNode).toHaveBeenCalledWith("node-a");
    expect(onOpenNode).toHaveBeenCalledTimes(1);
  });

  it("selects a different item without opening it", () => {
    const onOpenBackgroundContextMenu = vi.fn();
    const onOpenItemContextMenu = vi.fn();
    const onOpenNode = vi.fn();
    const { item, secondItem } = renderHarness(onOpenBackgroundContextMenu, onOpenItemContextMenu, onOpenNode);

    tap(item, 1);
    tap(secondItem, 2);

    expect(item.getAttribute("aria-selected")).toBe("false");
    expect(secondItem.getAttribute("aria-selected")).toBe("true");
    expect(onOpenNode).not.toHaveBeenCalled();
  });

  it("opens the existing item context-menu boundary on a long press and suppresses ghost activation", () => {
    vi.useFakeTimers();
    const onOpenBackgroundContextMenu = vi.fn();
    const onOpenItemContextMenu = vi.fn();
    const onOpenNode = vi.fn();
    const { item } = renderHarness(onOpenBackgroundContextMenu, onOpenItemContextMenu, onOpenNode);

    act(() => item.dispatchEvent(createPointerEvent("pointerdown")));
    act(() => vi.advanceTimersByTime(500));
    expect(onOpenItemContextMenu).toHaveBeenCalledWith("node-a", 32, 44);

    act(() => item.dispatchEvent(createPointerEvent("pointerup")));
    act(() => item.click());
    expect(onOpenNode).not.toHaveBeenCalled();
    expect(onOpenItemContextMenu).toHaveBeenCalledTimes(1);
  });

  it("cancels activation after a scroll movement and still supports a background long press", () => {
    vi.useFakeTimers();
    const onOpenBackgroundContextMenu = vi.fn();
    const onOpenItemContextMenu = vi.fn();
    const onOpenNode = vi.fn();
    const { item, surface } = renderHarness(onOpenBackgroundContextMenu, onOpenItemContextMenu, onOpenNode);

    act(() => item.dispatchEvent(createPointerEvent("pointerdown")));
    act(() => item.dispatchEvent(createPointerEvent("pointermove", { clientX: 60, clientY: 44 })));
    act(() => item.dispatchEvent(createPointerEvent("pointerup", { clientX: 60, clientY: 44 })));
    act(() => item.click());
    expect(onOpenNode).not.toHaveBeenCalled();
    expect(onOpenItemContextMenu).not.toHaveBeenCalled();

    act(() => surface.dispatchEvent(createPointerEvent("pointerdown", { clientX: 100, clientY: 120, pointerId: 2 })));
    act(() => vi.advanceTimersByTime(500));
    expect(onOpenBackgroundContextMenu).toHaveBeenCalledWith(100, 120);
  });
});
