// @vitest-environment jsdom
import { StrictMode, act, useReducer, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsNodeId } from "../../vfs/types";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";
import { KonquerorIconView } from "./KonquerorIconView";
import { buildKonquerorDragOperationPlan, type KonquerorDragOperationPlan } from "./dragDropController";
import { createInitialKonquerorNavigationState, konquerorNavigationReducer } from "./navigationState";
import type { KonquerorSelectionPointerIntent } from "./selectionModel";
import type { KonquerorVisibleTreeRow } from "./treeProjection";

type ResourceView = "tree" | "icons";

const vfsState = createInitialVfsState();
const visibleNodeIds = ["vfs-documents", "vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1", "vfs-desktop"] as const;
const treeRows: readonly KonquerorVisibleTreeRow[] = [
  { nodeId: "vfs-documents", parentId: vfsState.specialLocations.home, depth: 0, expandable: true, expanded: true, hasChildren: true, isLastSibling: false, ancestorContinuation: [] },
  { nodeId: "vfs-content-e594a065214576326cb903a5", parentId: "vfs-documents", depth: 1, expandable: false, expanded: false, hasChildren: false, isLastSibling: false, ancestorContinuation: [true] },
  { nodeId: "vfs-content-76cff3ce17d8a853403179f1", parentId: "vfs-documents", depth: 1, expandable: false, expanded: false, hasChildren: false, isLastSibling: true, ancestorContinuation: [true] },
  { nodeId: "vfs-desktop", parentId: vfsState.specialLocations.home, depth: 0, expandable: true, expanded: false, hasChildren: false, isLastSibling: true, ancestorContinuation: [] },
];

let container: HTMLDivElement;
let reactRoot: Root;
let capturedPointerIds: Set<number>;
let originalSetPointerCapture: PropertyDescriptor | undefined;
let originalReleasePointerCapture: PropertyDescriptor | undefined;
let originalHasPointerCapture: PropertyDescriptor | undefined;
let originalElementFromPoint: PropertyDescriptor | undefined;

const dispatchPointer = (element: HTMLElement, type: string, pointerId: number, clientX: number, clientY: number, button = 0): void => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button, clientX, clientY });
  Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: true } });
  act(() => element.dispatchEvent(event));
};

function DragSurface({
  resourceView,
  initialSelectedNodeIds = [],
  onActivate,
  onDrop,
}: {
  readonly resourceView: ResourceView;
  readonly initialSelectedNodeIds?: readonly VfsNodeId[];
  readonly onActivate: ReturnType<typeof vi.fn<(nodeIds: readonly VfsNodeId[]) => KonquerorDragOperationPlan | null>>;
  readonly onDrop: ReturnType<typeof vi.fn<(plan: KonquerorDragOperationPlan, targetNodeId: VfsNodeId) => void>>;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [navigationState, dispatchNavigation] = useReducer(
    konquerorNavigationReducer,
    undefined,
    () => ({
      ...createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user"),
      selectedNodeIds: initialSelectedNodeIds,
    }),
  );
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
    childrenNodes: treeRows.map((row) => vfsState.nodesById[row.nodeId]),
    selectedNodeIds: navigationState.selectedNodeIds,
    rangeAnchorNodeId: navigationState.rangeAnchorNodeId,
    vfsState,
    marqueeViewportRef: viewportRef,
    onSelectNode,
    onClearSelection: () => dispatchNavigation({ type: "clear-selection" }),
    onCommitMarquee: () => undefined,
    onOpenNode: () => undefined,
    onMoveSelection: () => undefined,
    canAcceptDropTarget: (nodeId: VfsNodeId) => nodeId === "vfs-desktop",
    onActivateItemDrag: onActivate,
    onDropItemDrag: (plan: KonquerorDragOperationPlan, targetNodeId: VfsNodeId) => onDrop(plan, targetNodeId),
  };

  return (
    <div ref={viewportRef} className="konqueror-directory-viewport">
      {resourceView === "tree" ? <KonquerorDirectoryView {...sharedProps} treeRows={treeRows} /> : <KonquerorIconView {...sharedProps} />}
    </div>
  );
}

const renderSurface = (
  resourceView: ResourceView,
  initialSelectedNodeIds: readonly VfsNodeId[] = [],
) => {
  const onActivate = vi.fn((nodeIds: readonly VfsNodeId[]) => {
    const plan = buildKonquerorDragOperationPlan(vfsState, nodeIds);
    return plan.ok ? plan.value : null;
  });
  const onDrop = vi.fn();
  act(() => {
    reactRoot.render(
      <StrictMode>
        <DragSurface resourceView={resourceView} initialSelectedNodeIds={initialSelectedNodeIds} onActivate={onActivate} onDrop={onDrop} />
      </StrictMode>,
    );
  });
  return { onActivate, onDrop };
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  capturedPointerIds = new Set();
  originalSetPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
  originalReleasePointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "releasePointerCapture");
  originalHasPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hasPointerCapture");
  originalElementFromPoint = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.add(pointerId) });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.delete(pointerId) });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: (pointerId: number) => capturedPointerIds.has(pointerId) });
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => null });
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
  if (originalElementFromPoint) Object.defineProperty(document, "elementFromPoint", originalElementFromPoint);
  else delete (document as Partial<Document>).elementFromPoint;
  vi.restoreAllMocks();
});

describe("Konqueror item drag", () => {
  it("keeps a selected Tree group in visible order and freezes a same-surface folder drop", () => {
    const { onActivate, onDrop } = renderSurface("tree", ["vfs-content-76cff3ce17d8a853403179f1", "vfs-content-e594a065214576326cb903a5"]);
    const surface = container.querySelector<HTMLElement>(".konqueror-directory-view");
    const label = [...container.querySelectorAll<HTMLElement>(".konqueror-tree-label")].find((item) => item.textContent === "Notes.txt");
    const target = container.querySelector<HTMLElement>("[data-konqueror-node-id='vfs-desktop']");
    if (!surface || !label || !target) throw new Error("Drag fixture missing");
    vi.spyOn(document, "elementFromPoint").mockReturnValue(target);

    dispatchPointer(label, "pointerdown", 1, 20, 20);
    dispatchPointer(surface, "pointermove", 1, 26, 20);
    expect(onActivate).toHaveBeenCalledWith(["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"]);
    expect(capturedPointerIds.has(1)).toBe(true);
    expect(target.classList.contains("is-drop-target")).toBe(true);

    dispatchPointer(surface, "pointerup", 1, 26, 20);
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({
      rawDraggedNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
      operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
    }), "vfs-desktop");
    expect(capturedPointerIds.has(1)).toBe(false);
  });

  it("does not activate a Tree drag below threshold or from the branch gutter, while an unselected label replaces selection on activation", () => {
    const { onActivate } = renderSurface("tree", ["vfs-content-76cff3ce17d8a853403179f1"]);
    const surface = container.querySelector<HTMLElement>(".konqueror-directory-view");
    const rows = [...container.querySelectorAll<HTMLElement>(".konqueror-directory-row")];
    const label = [...container.querySelectorAll<HTMLElement>(".konqueror-tree-label")].find((item) => item.textContent === "Notes.txt");
    if (!surface || !label || rows.length === 0) throw new Error("Tree fixture missing");

    dispatchPointer(label, "pointerdown", 2, 20, 20);
    dispatchPointer(surface, "pointermove", 2, 22, 20);
    dispatchPointer(surface, "pointerup", 2, 22, 20);
    expect(onActivate).not.toHaveBeenCalled();

    dispatchPointer(rows[0], "pointerdown", 3, 5, 5);
    dispatchPointer(surface, "pointermove", 3, 12, 5);
    expect(onActivate).not.toHaveBeenCalled();

    dispatchPointer(label, "pointerdown", 4, 20, 20);
    dispatchPointer(surface, "pointermove", 4, 26, 20);
    expect(onActivate).toHaveBeenLastCalledWith(["vfs-content-e594a065214576326cb903a5"]);
    expect(container.querySelector("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("[data-konqueror-node-id='vfs-content-76cff3ce17d8a853403179f1']")?.getAttribute("aria-selected")).toBe("false");
  });

  it("uses the Icon cell as the drag source and ignores non-primary pointer input", () => {
    const { onActivate } = renderSurface("icons");
    const surface = container.querySelector<HTMLElement>(".konqueror-icon-view");
    const notes = container.querySelector<HTMLElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']");
    if (!surface || !notes) throw new Error("Icon fixture missing");

    dispatchPointer(notes, "pointerdown", 5, 20, 20, 2);
    dispatchPointer(surface, "pointermove", 5, 30, 20, 2);
    expect(onActivate).not.toHaveBeenCalled();

    dispatchPointer(notes, "pointerdown", 6, 20, 20);
    dispatchPointer(surface, "pointermove", 6, 26, 20);
    expect(onActivate).toHaveBeenCalledWith(["vfs-content-e594a065214576326cb903a5"]);
  });
});
