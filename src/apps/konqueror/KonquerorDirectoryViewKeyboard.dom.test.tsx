// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";

let container: HTMLDivElement;
let reactRoot: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
});

describe("Konqueror Tree hierarchy keyboard surface", () => {
  it("delegates unmodified Left and Right locally while retaining Tree focus", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById[state.specialLocations.documents];
    if (!documents) throw new Error("Documents fixture missing");
    const onTreeKeyboardAction = vi.fn();

    act(() => {
      reactRoot.render(
        <KonquerorDirectoryView
          childrenNodes={[documents]}
          treeRows={[{ nodeId: documents.id, parentId: state.specialLocations.home, depth: 0, expandable: true, expanded: false, hasChildren: true, isLastSibling: true, ancestorContinuation: [] }]}
          selectedNodeIds={[documents.id]}
          vfsState={state}
          onSelectNode={() => undefined}
          onClearSelection={() => undefined}
          onOpenNode={() => undefined}
          onTreeKeyboardAction={onTreeKeyboardAction}
        />,
      );
    });

    const tree = container.querySelector<HTMLDivElement>(".konqueror-directory-view");
    if (!tree) throw new Error("Tree surface missing");
    tree.focus();
    const right = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" });
    act(() => tree.dispatchEvent(right));

    expect(right.defaultPrevented).toBe(true);
    expect(onTreeKeyboardAction).toHaveBeenCalledWith("ArrowRight");
    expect(document.activeElement).toBe(tree);

    const modifiedLeft = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowLeft", ctrlKey: true });
    act(() => tree.dispatchEvent(modifiedLeft));
    expect(modifiedLeft.defaultPrevented).toBe(false);
    expect(onTreeKeyboardAction).toHaveBeenCalledTimes(1);
  });
});
