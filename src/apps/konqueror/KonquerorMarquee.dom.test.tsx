// @vitest-environment jsdom
import { StrictMode, act, useReducer, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsNode, VfsNodeId } from "../../vfs/types";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";
import { KonquerorIconView } from "./KonquerorIconView";
import { createInitialKonquerorNavigationState, konquerorNavigationReducer } from "./navigationState";
import type { KonquerorSelectionPointerIntent } from "./selectionModel";
import type { KonquerorVisibleTreeRow } from "./treeProjection";

type ResourceView = "tree" | "icons";
type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; readonly width: number; readonly height: number; readonly x: number; readonly y: number; toJSON: () => Record<string, never> };

const vfsState = createInitialVfsState();
const childrenNodes = [
  vfsState.nodesById[vfsState.specialLocations.documents],
  vfsState.nodesById[vfsState.specialLocations.downloads],
  vfsState.nodesById[vfsState.specialLocations.music],
  vfsState.nodesById[vfsState.specialLocations.pictures],
];

let container: HTMLDivElement;
let reactRoot: Root;
let capturedPointerIds: Set<number>;
let originalSetPointerCapture: PropertyDescriptor | undefined;
let originalReleasePointerCapture: PropertyDescriptor | undefined;
let originalHasPointerCapture: PropertyDescriptor | undefined;

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
  x: left,
  y: top,
  toJSON: () => ({}),
});

function MarqueeSurface({
  resourceView,
  initialSelectedNodeIds = [],
  initialRangeAnchorNodeId = null,
  treeRows,
}: {
  readonly resourceView: ResourceView;
  readonly initialSelectedNodeIds?: readonly VfsNodeId[];
  readonly initialRangeAnchorNodeId?: VfsNodeId | null;
  readonly treeRows?: readonly KonquerorVisibleTreeRow[];
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [navigationState, dispatchNavigation] = useReducer(
    konquerorNavigationReducer,
    undefined,
    () => ({
      ...createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user"),
      selectedNodeIds: initialSelectedNodeIds,
      rangeAnchorNodeId: initialRangeAnchorNodeId,
    }),
  );
  const visibleNodeIds = childrenNodes.map((node) => node.id);
  const onSelectNode = (nodeId: VfsNodeId, intent: KonquerorSelectionPointerIntent) => {
    if (intent === "replace") {
      dispatchNavigation({ type: "replace-selection", nodeId });
      return;
    }

    if (intent === "toggle") {
      dispatchNavigation({ type: "toggle-selection", nodeId });
      return;
    }

    dispatchNavigation({
      type: intent === "replace-range" ? "replace-selection-range" : "add-selection-range",
      visibleNodeIds,
      targetNodeId: nodeId,
    });
  };
  const sharedProps = {
    childrenNodes: childrenNodes as readonly VfsNode[],
    selectedNodeIds: navigationState.selectedNodeIds,
    rangeAnchorNodeId: navigationState.rangeAnchorNodeId,
    vfsState,
    marqueeViewportRef: viewportRef,
    onSelectNode,
    onClearSelection: () => dispatchNavigation({ type: "clear-selection" }),
    onCommitMarquee: (mode: "replace" | "add", baselineSelectedNodeIds: readonly VfsNodeId[], baselineRangeAnchorNodeId: VfsNodeId | null, orderedNodeIds: readonly VfsNodeId[], hitNodeIds: readonly VfsNodeId[]) => dispatchNavigation({
      type: "commit-marquee-selection",
      mode,
      baselineSelectedNodeIds,
      baselineRangeAnchorNodeId,
      visibleNodeIds: orderedNodeIds,
      hitNodeIds,
    }),
    onOpenNode: vi.fn(),
    onMoveSelection: () => undefined,
  };

  return (
    <div ref={viewportRef} className="konqueror-directory-viewport" data-anchor={navigationState.rangeAnchorNodeId ?? ""}>
      {resourceView === "tree" ? <KonquerorDirectoryView {...sharedProps} treeRows={treeRows} /> : <KonquerorIconView {...sharedProps} />}
    </div>
  );
}

const renderSurface = (
  resourceView: ResourceView,
  initialSelectedNodeIds: readonly VfsNodeId[] = [],
  initialRangeAnchorNodeId: VfsNodeId | null = null,
  treeRows?: readonly KonquerorVisibleTreeRow[],
): void => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <MarqueeSurface resourceView={resourceView} initialSelectedNodeIds={initialSelectedNodeIds} initialRangeAnchorNodeId={initialRangeAnchorNodeId} treeRows={treeRows} />
      </StrictMode>,
    );
  });
};

const dispatchPointer = (
  element: HTMLElement,
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  ctrlKey = false,
  button = 0,
): void => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button, clientX, clientY, ctrlKey });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: true },
  });
  act(() => element.dispatchEvent(event));
};

const setGeometry = (surface: HTMLElement, itemSelector: string, itemRects: readonly Rect[]): void => {
  const viewport = surface.parentElement as HTMLDivElement;
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 0, 200, 200) as DOMRect);
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 200 });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 200 });
  Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 0, writable: true });
  Object.defineProperty(viewport, "scrollTop", { configurable: true, value: 0, writable: true });
  setItemGeometry(surface, itemSelector, itemRects);
};

const setItemGeometry = (surface: HTMLElement, itemSelector: string, itemRects: readonly Rect[]): void => {
  [...surface.querySelectorAll<HTMLElement>(itemSelector)].forEach((item, index) => {
    vi.spyOn(item, "getBoundingClientRect").mockReturnValue(itemRects[index] as DOMRect);
  });
};

const selectedStates = (selector: string): string[] =>
  [...container.querySelectorAll<HTMLElement>(selector)].map((item) => item.getAttribute("aria-selected") ?? "");

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  capturedPointerIds = new Set();
  originalSetPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
  originalReleasePointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "releasePointerCapture");
  originalHasPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hasPointerCapture");
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.add(pointerId) });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.delete(pointerId) });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.has(pointerId) });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  if (originalSetPointerCapture) Object.defineProperty(HTMLElement.prototype, "setPointerCapture", originalSetPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
  if (originalReleasePointerCapture) Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", originalReleasePointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture;
  if (originalHasPointerCapture) Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", originalHasPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).hasPointerCapture;
  vi.restoreAllMocks();
});

describe("Konqueror Resource marquee selection", () => {
  it("replaces Icon preview hits without path-latching and suppresses the following background click", () => {
    renderSurface("icons", [childrenNodes[0].id, childrenNodes[1].id], childrenNodes[1].id);
    const surface = container.querySelector<HTMLElement>(".konqueror-icon-view");
    if (!surface) throw new Error("Missing Icon View");
    setGeometry(surface, ".konqueror-icon-item", [rect(20, 20, 40, 40), rect(60, 20, 80, 40), rect(100, 20, 120, 40), rect(140, 20, 160, 40)]);

    dispatchPointer(surface, "pointerdown", 1, 5, 5);
    dispatchPointer(surface, "pointermove", 1, 130, 50);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "false"]);
    expect(surface.querySelector(".konqueror-selection-marquee")).not.toBeNull();

    dispatchPointer(surface, "pointermove", 1, 50, 50);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);
    dispatchPointer(surface, "pointerup", 1, 50, 50);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);
    expect(surface.parentElement?.getAttribute("data-anchor")).toBe("");
    act(() => surface.click());
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);
  });

  it("adds Ctrl marquee hits to its frozen baseline and keeps the prior range anchor", () => {
    renderSurface("icons", [childrenNodes[0].id, childrenNodes[1].id], childrenNodes[1].id);
    const surface = container.querySelector<HTMLElement>(".konqueror-icon-view");
    if (!surface) throw new Error("Missing Icon View");
    setGeometry(surface, ".konqueror-icon-item", [rect(20, 20, 40, 40), rect(60, 20, 80, 40), rect(100, 20, 120, 40), rect(140, 20, 160, 40)]);

    dispatchPointer(surface, "pointerdown", 2, 85, 5, true);
    dispatchPointer(surface, "pointermove", 2, 170, 50, true);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "true"]);
    dispatchPointer(surface, "pointermove", 2, 130, 50, true);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "false"]);
    dispatchPointer(surface, "pointerup", 2, 130, 50, true);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "false"]);
    expect(surface.parentElement?.getAttribute("data-anchor")).toBe(childrenNodes[1].id);
  });

  it("keeps scaled pointer, overlay, and item hit geometry aligned", () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as CSSStyleDeclaration));
    renderSurface("icons");
    const surface = container.querySelector<HTMLElement>(".konqueror-icon-view");
    if (!surface) throw new Error("Missing Icon View");
    const viewport = surface.parentElement as HTMLDivElement;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 0, 280, 280) as DOMRect);
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 0, writable: true });
    Object.defineProperty(viewport, "scrollTop", { configurable: true, value: 0, writable: true });
    setItemGeometry(surface, ".konqueror-icon-item", [
      rect(28, 28, 56, 56),
      rect(84, 28, 112, 56),
      rect(140, 28, 168, 56),
      rect(196, 28, 224, 56),
    ]);

    dispatchPointer(surface, "pointerdown", 30, 7, 7);
    dispatchPointer(surface, "pointermove", 30, 182, 182);
    expect(surface.querySelector<HTMLElement>(".konqueror-selection-marquee")?.style.left).toBe("5px");
    expect(surface.querySelector<HTMLElement>(".konqueror-selection-marquee")?.style.top).toBe("5px");
    expect(surface.querySelector<HTMLElement>(".konqueror-selection-marquee")?.style.width).toBe("125px");
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "false"]);

    dispatchPointer(surface, "pointerup", 30, 182, 182);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "false"]);
  });

  it("uses the threshold for blank clicks, clamps outside drags, and cancels on Escape", () => {
    renderSurface("icons", [childrenNodes[0].id], childrenNodes[0].id);
    const surface = container.querySelector<HTMLElement>(".konqueror-icon-view");
    if (!surface) throw new Error("Missing Icon View");
    setGeometry(surface, ".konqueror-icon-item", [rect(20, 20, 40, 40), rect(60, 20, 80, 40), rect(100, 20, 120, 40), rect(140, 20, 160, 40)]);

    dispatchPointer(surface, "pointerdown", 3, 5, 5);
    dispatchPointer(surface, "pointermove", 3, 7, 7);
    expect(surface.querySelector(".konqueror-selection-marquee")).toBeNull();
    dispatchPointer(surface, "pointerup", 3, 7, 7);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["false", "false", "false", "false"]);
    expect(surface.parentElement?.getAttribute("data-anchor")).toBe("");

    dispatchPointer(surface, "pointerdown", 4, 5, 5);
    dispatchPointer(surface, "pointermove", 4, 300, 300);
    expect(surface.querySelector<HTMLElement>(".konqueror-selection-marquee")?.style.width).toBe("195px");
    dispatchPointer(surface, "pointerup", 4, 300, 300);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "true", "true", "true"]);

    dispatchPointer(surface, "pointerdown", 5, 5, 5);
    dispatchPointer(surface, "pointermove", 5, 100, 50);
    act(() => surface.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" })));
    expect(surface.querySelector(".konqueror-selection-marquee")).toBeNull();
    expect(selectedStates(".konqueror-icon-item")).toEqual(["false", "false", "false", "false"]);
    dispatchPointer(surface, "pointerup", 5, 100, 50);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["false", "false", "false", "false"]);

    act(() => surface.querySelector<HTMLElement>(".konqueror-icon-item")?.click());
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);
    dispatchPointer(surface, "pointerdown", 6, 5, 5);
    dispatchPointer(surface, "pointerup", 6, 240, 240);
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);

    dispatchPointer(surface, "pointerdown", 7, 5, 5);
    dispatchPointer(surface, "pointermove", 7, 100, 50);
    dispatchPointer(surface, "pointercancel", 7, 100, 50);
    expect(surface.querySelector(".konqueror-selection-marquee")).toBeNull();
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);

    dispatchPointer(surface, "pointerdown", 8, 5, 5);
    dispatchPointer(surface, "pointermove", 8, 100, 50);
    dispatchPointer(surface, "lostpointercapture", 8, 100, 50);
    expect(surface.querySelector(".konqueror-selection-marquee")).toBeNull();
    expect(selectedStates(".konqueror-icon-item")).toEqual(["true", "false", "false", "false"]);

    dispatchPointer(surface, "pointerdown", 9, 5, 5, false, 2);
    dispatchPointer(surface, "pointermove", 9, 100, 50, false, 2);
    expect(surface.querySelector(".konqueror-selection-marquee")).toBeNull();
  });

  it("starts only from Tree blank background and selects rows through their rendered Name labels", () => {
    renderSurface("tree");
    const surface = container.querySelector<HTMLElement>(".konqueror-directory-view");
    const rows = [...container.querySelectorAll<HTMLElement>(".konqueror-directory-row")];
    if (!surface || rows.length < 4) throw new Error("Missing Tree View");
    setGeometry(surface, ".konqueror-directory-row", [rect(0, 20, 200, 40), rect(0, 50, 200, 70), rect(0, 80, 200, 100), rect(0, 110, 200, 130)]);
    setItemGeometry(surface, ".konqueror-tree-label", [rect(80, 20, 130, 40), rect(80, 50, 130, 70), rect(80, 80, 130, 100), rect(80, 110, 130, 130)]);

    dispatchPointer(rows[0], "pointerdown", 6, 100, 30);
    dispatchPointer(surface, "pointermove", 6, 100, 150);
    expect(surface.querySelector(".konqueror-selection-marquee")).toBeNull();

    dispatchPointer(surface, "pointerdown", 7, 5, 180);
    dispatchPointer(surface, "pointermove", 7, 195, 10);
    expect(selectedStates(".konqueror-directory-row")).toEqual(["true", "true", "true", "true"]);
    dispatchPointer(surface, "pointerup", 7, 195, 10);
    expect(selectedStates(".konqueror-directory-row")).toEqual(["true", "true", "true", "true"]);
  });

  it("uses only positive-area Tree Name label intersections for marquee hits", () => {
    renderSurface("tree");
    const surface = container.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!surface) throw new Error("Missing Tree View");
    setGeometry(surface, ".konqueror-directory-row", [rect(0, 20, 200, 40), rect(0, 50, 200, 70), rect(0, 80, 200, 100), rect(0, 110, 200, 130)]);
    setItemGeometry(surface, ".konqueror-tree-label", [rect(80, 20, 130, 40), rect(80, 50, 130, 70), rect(80, 80, 130, 100), rect(80, 110, 130, 130)]);

    dispatchPointer(surface, "pointerdown", 20, 5, 180);
    dispatchPointer(surface, "pointermove", 20, 60, 10);
    dispatchPointer(surface, "pointerup", 20, 60, 10);
    expect(selectedStates(".konqueror-directory-row")).toEqual(["false", "false", "false", "false"]);

    dispatchPointer(surface, "pointerdown", 21, 5, 180);
    dispatchPointer(surface, "pointermove", 21, 80, 10);
    dispatchPointer(surface, "pointerup", 21, 80, 10);
    expect(selectedStates(".konqueror-directory-row")).toEqual(["false", "false", "false", "false"]);

    dispatchPointer(surface, "pointerdown", 22, 5, 180);
    dispatchPointer(surface, "pointermove", 22, 81, 10);
    dispatchPointer(surface, "pointerup", 22, 81, 10);
    expect(selectedStates(".konqueror-directory-row")).toEqual(["true", "true", "true", "true"]);

    dispatchPointer(surface, "pointerdown", 23, 150, 180);
    dispatchPointer(surface, "pointermove", 23, 195, 10);
    dispatchPointer(surface, "pointerup", 23, 195, 10);
    expect(selectedStates(".konqueror-directory-row")).toEqual(["false", "false", "false", "false"]);
  });

  it("orders nested Tree marquee hits by the supplied visible DFS rows", () => {
    const treeRows: readonly KonquerorVisibleTreeRow[] = [
      { nodeId: childrenNodes[0].id, parentId: vfsState.specialLocations.home, depth: 0, expandable: true, expanded: true, hasChildren: true, isLastSibling: false, ancestorContinuation: [] },
      { nodeId: "vfs-content-e594a065214576326cb903a5", parentId: childrenNodes[0].id, depth: 1, expandable: false, expanded: false, hasChildren: false, isLastSibling: false, ancestorContinuation: [true] },
      { nodeId: "vfs-content-76cff3ce17d8a853403179f1", parentId: childrenNodes[0].id, depth: 1, expandable: false, expanded: false, hasChildren: false, isLastSibling: true, ancestorContinuation: [true] },
      { nodeId: childrenNodes[3].id, parentId: vfsState.specialLocations.home, depth: 0, expandable: true, expanded: false, hasChildren: false, isLastSibling: true, ancestorContinuation: [] },
    ];
    renderSurface("tree", [], null, treeRows);
    const surface = container.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!surface) throw new Error("Missing nested Tree View");
    setGeometry(surface, ".konqueror-directory-row", [rect(0, 20, 200, 40), rect(0, 50, 200, 70), rect(0, 80, 200, 100), rect(0, 110, 200, 130)]);
    setItemGeometry(surface, ".konqueror-tree-label", [rect(80, 20, 130, 40), rect(96, 50, 146, 70), rect(96, 80, 146, 100), rect(80, 110, 130, 130)]);

    dispatchPointer(surface, "pointerdown", 10, 5, 180);
    dispatchPointer(surface, "pointermove", 10, 195, 45);
    dispatchPointer(surface, "pointerup", 10, 195, 45);

    expect(selectedStates(".konqueror-directory-row")).toEqual(["false", "true", "true", "true"]);
  });
});
