// @vitest-environment jsdom
import { StrictMode, act, useReducer } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsNode, VfsNodeId } from "../../vfs/types";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";
import { KonquerorIconView } from "./KonquerorIconView";
import { createInitialKonquerorNavigationState, konquerorNavigationReducer } from "./navigationState";
import type { KonquerorSelectionPointerIntent } from "./selectionModel";

type ResourceView = "tree" | "icons";

const vfsState = createInitialVfsState();
const childrenNodes = [
  vfsState.nodesById[vfsState.specialLocations.documents],
  vfsState.nodesById[vfsState.specialLocations.downloads],
  vfsState.nodesById[vfsState.specialLocations.music],
  vfsState.nodesById[vfsState.specialLocations.pictures],
];

let container: HTMLDivElement;
let reactRoot: Root;
let onOpenNode: ReturnType<typeof vi.fn>;
let onOpenItemContextMenu: ReturnType<typeof vi.fn>;
let onOpenBackgroundContextMenu: ReturnType<typeof vi.fn>;

function SelectionSurface({
  resourceView,
  isTrashRoot = false,
  surfaceChildrenNodes = childrenNodes,
}: {
  readonly resourceView: ResourceView;
  readonly isTrashRoot?: boolean;
  readonly surfaceChildrenNodes?: readonly VfsNode[];
}) {
  const [navigationState, dispatchNavigation] = useReducer(
    konquerorNavigationReducer,
    undefined,
    () => createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user"),
  );
  const visibleNodeIds = surfaceChildrenNodes.map((node) => node.id);
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
    childrenNodes: surfaceChildrenNodes,
    selectedNodeIds: navigationState.selectedNodeIds,
    vfsState,
    isTrashRoot,
    onSelectNode,
    onClearSelection: () => dispatchNavigation({ type: "clear-selection" }),
    onOpenNode,
    onOpenItemContextMenu,
    onOpenBackgroundContextMenu,
  };

  return resourceView === "tree" ? (
    <KonquerorDirectoryView {...sharedProps} onMoveSelection={() => undefined} />
  ) : (
    <KonquerorIconView {...sharedProps} onMoveSelection={() => undefined} />
  );
}

const renderSurface = (
  resourceView: ResourceView,
  isTrashRoot = false,
  surfaceChildrenNodes: readonly VfsNode[] = childrenNodes,
): void => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <SelectionSurface resourceView={resourceView} isTrashRoot={isTrashRoot} surfaceChildrenNodes={surfaceChildrenNodes} />
      </StrictMode>,
    );
  });
};

const click = (element: HTMLElement): void => {
  act(() => element.click());
};

const ctrlClick = (element: HTMLElement): void => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true })));
};

const shiftClick = (element: HTMLElement): void => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, shiftKey: true })));
};

const ctrlShiftClick = (element: HTMLElement): void => {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true, shiftKey: true })));
};

const contextMenu = (element: HTMLElement, clientX: number, clientY: number): MouseEvent => {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY });
  act(() => element.dispatchEvent(event));
  return event;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  onOpenNode = vi.fn();
  onOpenItemContextMenu = vi.fn();
  onOpenBackgroundContextMenu = vi.fn();
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konqueror directory background selection", () => {
  it("routes only Tree item content to item context menus and treats all row remainder as background", () => {
    const fileNode = vfsState.nodesById["vfs-content-e594a065214576326cb903a5"];
    if (!fileNode) throw new Error("Missing file fixture");
    renderSurface("tree", false, [childrenNodes[0]!, fileNode]);
    const rows = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    const directoryRow = rows[0];
    const fileRow = rows[1];
    if (!directoryRow || !fileRow) throw new Error("Missing Tree View fixture rows");
    const directoryTarget = directoryRow.querySelector<HTMLElement>(".konqueror-directory-item-hit-target");
    const directoryIcon = directoryTarget?.querySelector<HTMLElement>(".konqueror-node-icon");
    const fileTarget = fileRow.querySelector<HTMLElement>(".konqueror-directory-item-hit-target");
    const fileName = fileTarget?.querySelector<HTMLElement>(".konqueror-tree-label");
    const directoryNameCell = directoryRow.querySelector<HTMLElement>(".konqueror-directory-cell--name");
    const detailCells = [...directoryRow.querySelectorAll<HTMLElement>(".konqueror-directory-cell:not(.konqueror-directory-cell--name)")];
    if (!directoryTarget || !directoryIcon || !fileTarget || !fileName || !directoryNameCell || detailCells.length !== 3) {
      throw new Error("Missing Tree View context-menu targets");
    }

    expect(contextMenu(directoryIcon, 11, 12).defaultPrevented).toBe(true);
    expect(contextMenu(fileName, 13, 14).defaultPrevented).toBe(true);
    expect(onOpenItemContextMenu).toHaveBeenNthCalledWith(1, childrenNodes[0]!.id, 11, 12);
    expect(onOpenItemContextMenu).toHaveBeenNthCalledWith(2, fileNode.id, 13, 14);

    contextMenu(directoryNameCell, 21, 22);
    detailCells.forEach((cell, index) => contextMenu(cell, 30 + index, 40 + index));
    click(directoryRow);
    detailCells.forEach((cell, index) => contextMenu(cell, 50 + index, 60 + index));
    expect(onOpenItemContextMenu).toHaveBeenCalledTimes(2);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(1, 21, 22);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(2, 30, 40);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(3, 31, 41);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(4, 32, 42);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(5, 50, 60);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(6, 51, 61);
    expect(onOpenBackgroundContextMenu).toHaveBeenNthCalledWith(7, 52, 62);
  });

  it("keeps full Tree rows as item targets while blank Tree background and Escape clear selection", () => {
    renderSurface("tree");
    const tree = container.querySelector<HTMLElement>(".konqueror-directory-view");
    const rows = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (!tree || rows.length < 2) throw new Error("Missing Tree View fixture");

    click(rows[0]);
    expect(rows[0].getAttribute("aria-selected")).toBe("true");
    click(rows[1]);
    expect(rows[1].getAttribute("aria-selected")).toBe("true");

    click(tree);
    expect(container.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
    expect(document.activeElement).toBe(tree);

    click(rows[0]);
    act(() => tree.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" })));
    expect(container.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
  });

  it("clears only Icon View background while keeping item descendants and double-click activation intact", () => {
    renderSurface("icons");
    const iconView = container.querySelector<HTMLElement>(".konqueror-icon-view");
    const items = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-icon-item[role='option']")];
    if (!iconView || items.length < 2) throw new Error("Missing Icon View fixture");

    const label = items[1].querySelector<HTMLElement>(".konqueror-icon-item__label");
    if (!label) throw new Error("Missing Icon View item label");
    click(label);
    expect(items[1].getAttribute("aria-selected")).toBe("true");

    act(() => items[1].dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(onOpenNode).toHaveBeenCalledWith(childrenNodes[1].id);

    click(iconView);
    expect(container.querySelector(".konqueror-icon-item.is-selected")).toBeNull();
    expect(document.activeElement).toBe(iconView);

    click(iconView);
    expect(container.querySelector(".konqueror-icon-item.is-selected")).toBeNull();
  });

  it("toggles multiple Icon items with Ctrl while ordinary clicks replace the full selection", () => {
    renderSurface("icons");
    const items = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-icon-item[role='option']")];
    if (items.length < 2) throw new Error("Missing Icon View fixture");

    click(items[0]);
    ctrlClick(items[1]);
    expect(items.map((item) => item.getAttribute("aria-selected"))).toEqual(["true", "true", "false", "false"]);

    ctrlClick(items[0]);
    expect(items.map((item) => item.getAttribute("aria-selected"))).toEqual(["false", "true", "false", "false"]);

    click(items[0]);
    expect(items.map((item) => item.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
  });

  it("selects inclusive Icon ranges and adds Ctrl+Shift ranges without toggling members", () => {
    renderSurface("icons");
    const items = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-icon-item[role='option']")];
    if (items.length < 4) throw new Error("Missing Icon View range fixture");

    click(items[0]);
    shiftClick(items[2]);
    expect(items.map((item) => item.getAttribute("aria-selected"))).toEqual(["true", "true", "true", "false"]);

    shiftClick(items[1]);
    expect(items.map((item) => item.getAttribute("aria-selected"))).toEqual(["true", "true", "false", "false"]);

    ctrlClick(items[3]);
    ctrlShiftClick(items[2]);
    expect(items.map((item) => item.getAttribute("aria-selected"))).toEqual(["true", "true", "true", "true"]);
  });

  it("toggles multiple full-width Tree rows without treating row whitespace as background", () => {
    renderSurface("tree");
    const rows = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 2) throw new Error("Missing Tree View fixture");

    click(rows[0]);
    ctrlClick(rows[1]);
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "false", "false"]);

    const secondCell = rows[1].querySelector<HTMLElement>(".konqueror-directory-cell:not(.konqueror-directory-cell--name)");
    if (!secondCell) throw new Error("Missing Tree View row cell");
    click(secondCell);
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "true", "false", "false"]);
  });

  it("selects reverse Tree ranges while keeping full rows as item targets", () => {
    renderSurface("tree");
    const rows = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 4) throw new Error("Missing Tree View range fixture");

    click(rows[3]);
    shiftClick(rows[1]);
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "true", "true", "true"]);

    const thirdCell = rows[2].querySelector<HTMLElement>(".konqueror-directory-cell:not(.konqueror-directory-cell--name)");
    if (!thirdCell) throw new Error("Missing Tree View row cell");
    shiftClick(thirdCell);
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "true"]);
  });

  it("shares Ctrl-toggle membership between Icon and Tree renderers", () => {
    renderSurface("icons");
    const iconItems = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-icon-item[role='option']")];
    if (iconItems.length < 2) throw new Error("Missing Icon View fixture");

    click(iconItems[0]);
    ctrlClick(iconItems[1]);
    renderSurface("tree");
    const rows = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 2) throw new Error("Missing Tree View fixture");
    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "false", "false"]);

    ctrlClick(rows[1]);
    renderSurface("icons");
    expect([...container.querySelectorAll<HTMLButtonElement>(".konqueror-icon-item[role='option']")]
      .map((item) => item.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
  });

  it("keeps background context clicks separate and gives the shared Trash renderer the same blank-area clear", () => {
    renderSurface("tree", true);
    const tree = container.querySelector<HTMLElement>(".konqueror-directory-view");
    const row = container.querySelector<HTMLButtonElement>(".konqueror-directory-row[role='option']");
    if (!tree || !row) throw new Error("Missing Trash Tree View fixture");

    click(row);
    act(() => tree.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 12, clientY: 16 })));
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(onOpenBackgroundContextMenu).toHaveBeenCalledWith(12, 16);

    click(tree);
    expect(container.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
  });

  it("uses shared Shift ranges in Trash without adding bulk commands", () => {
    renderSurface("tree", true);
    const rows = [...container.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 4) throw new Error("Missing Trash Tree View fixture rows");

    click(rows[0]);
    shiftClick(rows[2]);
    ctrlShiftClick(rows[3]);

    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "true", "true"]);
  });

  it("keeps an empty directory background as a safe no-op clear surface", () => {
    renderSurface("tree", false, []);
    const tree = container.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!tree) throw new Error("Missing empty Tree View");

    click(tree);
    expect(container.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
    expect(document.activeElement).toBe(tree);
  });
});
