// @vitest-environment jsdom
import { StrictMode, act, useCallback, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KonquerorContextMenu } from "../apps/konqueror/KonquerorContextMenu";
import type { KonquerorContextMenuEntry } from "../apps/konqueror/contextMenuModel";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { useMeasuredPopupPosition } from "./useMeasuredPopupPosition";

type Request = {
  readonly requestId: number;
  readonly left: number;
  readonly top: number;
};

type HarnessProps = {
  readonly request: Request | null;
  readonly canResolve: boolean;
};

let container: HTMLDivElement;
let reactRoot: Root;

function PositioningHarness({ request, canResolve }: HarnessProps) {
  const popupRef = useRef<HTMLElement | null>(null);
  const resolvePosition = useCallback((_: HTMLElement, activeRequest: Request) =>
    canResolve ? { left: activeRequest.left, top: activeRequest.top } : null,
  [canResolve]);
  const { isPositioned, position } = useMeasuredPopupPosition(request, popupRef, resolvePosition);

  return (
    <section
      ref={popupRef}
      data-popup-positioning-harness="true"
      data-positioned={isPositioned}
      style={position ?? { visibility: "hidden", pointerEvents: "none" }}
    />
  );
}

const renderHarness = (props: HarnessProps) => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <PositioningHarness {...props} />
      </StrictMode>,
    );
  });
};

const getHarness = (): HTMLElement => {
  const popup = container.querySelector<HTMLElement>("[data-popup-positioning-harness='true']");

  if (!popup) {
    throw new Error("Missing popup positioning harness");
  }

  return popup;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("useMeasuredPopupPosition", () => {
  it("keeps a new request hidden until its exact measured position is available", () => {
    renderHarness({ request: { requestId: 1, left: 240, top: 180 }, canResolve: false });
    const popup = getHarness();

    expect(popup.style.visibility).toBe("hidden");
    expect(popup.style.pointerEvents).toBe("none");
    expect(popup.style.left).toBe("");
    expect(popup.style.top).toBe("");

    renderHarness({ request: { requestId: 1, left: 240, top: 180 }, canResolve: true });

    expect(popup.style.visibility).toBe("");
    expect(popup.style.pointerEvents).toBe("");
    expect(popup.style.left).toBe("240px");
    expect(popup.style.top).toBe("180px");
  });

  it("never exposes the previous request position while a reopen request is unresolved", () => {
    renderHarness({ request: { requestId: 1, left: 120, top: 90 }, canResolve: true });
    const popup = getHarness();
    expect(popup.style.left).toBe("120px");
    expect(popup.style.top).toBe("90px");

    renderHarness({ request: { requestId: 2, left: 640, top: 420 }, canResolve: false });

    expect(popup.style.visibility).toBe("hidden");
    expect(popup.style.pointerEvents).toBe("none");
    expect(popup.style.left).toBe("");
    expect(popup.style.top).toBe("");

    renderHarness({ request: { requestId: 2, left: 640, top: 420 }, canResolve: true });

    expect(popup.style.visibility).toBe("");
    expect(popup.style.left).toBe("640px");
    expect(popup.style.top).toBe("420px");
  });

  it("rejects a stale resolution after a newer request has become visible in StrictMode", () => {
    renderHarness({ request: { requestId: 2, left: 640, top: 420 }, canResolve: true });
    const popup = getHarness();

    renderHarness({ request: { requestId: 1, left: 120, top: 90 }, canResolve: true });
    expect(popup.style.visibility).toBe("hidden");
    expect(popup.style.left).toBe("");

    renderHarness({ request: { requestId: 2, left: 640, top: 420 }, canResolve: true });
    expect(popup.style.visibility).toBe("");
    expect(popup.style.left).toBe("640px");
    expect(popup.style.top).toBe("420px");
  });
});

describe("context-menu pre-paint surfaces", () => {
  it("renders the Desktop menu at its already-clamped first visible position", () => {
    const positioningContainer = document.createElement("div");
    document.body.append(positioningContainer);
    const containerRef = { current: positioningContainer };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      return this.classList.contains("desktop-context-menu")
        ? new DOMRect(0, 0, 192, 154)
        : new DOMRect(100, 50, 900, 686);
    });

    act(() => {
      reactRoot.render(
        <StrictMode>
          <DesktopContextMenu
            menuState={{ kind: "background", requestId: 1, desktopId: 1, clientX: 980, clientY: 700 }}
            containerRef={containerRef}
            screenArea={{ x: 0, y: 0, width: 900, height: 686 }}
            canEmptyTrash={false}
            onDismiss={() => undefined}
            onAction={() => undefined}
          />
        </StrictMode>,
      );
    });
    const popup = container.querySelector<HTMLElement>(".desktop-context-menu");

    expect(popup?.style.visibility).toBe("");
    expect(popup?.style.left).toBe("608px");
    expect(popup?.style.top).toBe("482px");
    positioningContainer.remove();
  });

  it("renders the Konqueror menu at its own current-size clamped first visible position", () => {
    const positioningContainer = document.createElement("div");
    document.body.append(positioningContainer);
    const containerRef = { current: positioningContainer };
    const entries: readonly KonquerorContextMenuEntry[] = [
      { kind: "action", action: "paste", label: "Paste", enabled: true, title: "Paste" },
    ];
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      return this.classList.contains("konqueror-context-menu")
        ? new DOMRect(0, 0, 168, 110)
        : new DOMRect(100, 50, 900, 686);
    });

    act(() => {
      reactRoot.render(
        <StrictMode>
          <KonquerorContextMenu
            menuState={{ kind: "item", requestId: 1, clickedNodeId: "vfs-content-e594a065214576326cb903a5", targetNodeIds: ["vfs-content-e594a065214576326cb903a5"], clientX: 980, clientY: 700 }}
            entries={entries}
            containerRef={containerRef}
            screenArea={{ x: 0, y: 0, width: 900, height: 686 }}
            onDismiss={() => undefined}
            onAction={() => undefined}
          />
        </StrictMode>,
      );
    });
    const popup = container.querySelector<HTMLElement>(".konqueror-context-menu");

    expect(popup?.style.visibility).toBe("");
    expect(popup?.style.left).toBe("632px");
    expect(popup?.style.top).toBe("526px");
    positioningContainer.remove();
  });
});
