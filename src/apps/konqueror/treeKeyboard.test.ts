import { describe, expect, it } from "vitest";
import type { KonquerorVisibleTreeRow } from "./treeProjection";
import { getKonquerorTreeKeyboardAction } from "./treeKeyboard";

const row = (overrides: Partial<KonquerorVisibleTreeRow>): KonquerorVisibleTreeRow => ({
  nodeId: "node",
  parentId: "root",
  depth: 0,
  expandable: false,
  expanded: false,
  hasChildren: false,
  isLastSibling: true,
  ancestorContinuation: [],
  ...overrides,
});

const expandedTree = [
  row({ nodeId: "folder", expandable: true, expanded: true, hasChildren: true, isLastSibling: false }),
  row({ nodeId: "child-b", parentId: "folder", depth: 1, isLastSibling: false, ancestorContinuation: [true] }),
  row({ nodeId: "child-c", parentId: "folder", depth: 1, isLastSibling: true, ancestorContinuation: [true] }),
  row({ nodeId: "sibling", isLastSibling: true }),
] as const;

describe("Konqueror Tree hierarchy keyboard planner", () => {
  it("retains classic two-step hierarchy behavior at deep visible levels", () => {
    const deepRows = [
      row({ nodeId: "a", expandable: true, expanded: true, isLastSibling: true }),
      row({ nodeId: "b", parentId: "a", depth: 1, expandable: true, expanded: true, isLastSibling: true, ancestorContinuation: [] }),
      row({ nodeId: "c", parentId: "b", depth: 2, expandable: true, expanded: true, isLastSibling: true, ancestorContinuation: [false] }),
      row({ nodeId: "d", parentId: "c", depth: 3, expandable: true, expanded: true, isLastSibling: true, ancestorContinuation: [false, false] }),
      row({ nodeId: "e", parentId: "d", depth: 4, expandable: true, expanded: true, isLastSibling: true, ancestorContinuation: [false, false, false] }),
      row({ nodeId: "f", parentId: "e", depth: 5, expandable: true, expanded: true, isLastSibling: true, ancestorContinuation: [false, false, false, false] }),
      row({ nodeId: "g", parentId: "f", depth: 6, expandable: true, expanded: true, isLastSibling: true, ancestorContinuation: [false, false, false, false, false] }),
      row({ nodeId: "h", parentId: "g", depth: 7, isLastSibling: true, ancestorContinuation: [false, false, false, false, false, false] }),
    ] as const;

    expect(getKonquerorTreeKeyboardAction("g", deepRows, "ArrowRight")).toEqual({ type: "select", nodeId: "h" });
    expect(getKonquerorTreeKeyboardAction("g", deepRows, "ArrowLeft")).toEqual({ type: "collapse", nodeId: "g" });
    expect(getKonquerorTreeKeyboardAction("h", deepRows, "ArrowLeft")).toEqual({ type: "select", nodeId: "g" });
  });

  it("expands collapsed directories, including empty directories, before moving to a child", () => {
    expect(getKonquerorTreeKeyboardAction("folder", [row({ nodeId: "folder", expandable: true, hasChildren: true })], "ArrowRight"))
      .toEqual({ type: "expand", nodeId: "folder" });
    expect(getKonquerorTreeKeyboardAction("empty", [row({ nodeId: "empty", expandable: true, hasChildren: false })], "ArrowRight"))
      .toEqual({ type: "expand", nodeId: "empty" });
  });

  it("uses the first visible direct child from the current DFS projection", () => {
    expect(getKonquerorTreeKeyboardAction("folder", expandedTree, "ArrowRight"))
      .toEqual({ type: "select", nodeId: "child-b" });
    expect(getKonquerorTreeKeyboardAction("folder", [
      row({ nodeId: "folder", expandable: true, expanded: true, hasChildren: true }),
      row({ nodeId: "sorted-first", parentId: "folder", depth: 1, isLastSibling: false }),
      row({ nodeId: "sorted-second", parentId: "folder", depth: 1, isLastSibling: true }),
    ], "ArrowRight")).toEqual({ type: "select", nodeId: "sorted-first" });
  });

  it("does not move an expanded empty directory or open files", () => {
    expect(getKonquerorTreeKeyboardAction("empty", [row({ nodeId: "empty", expandable: true, expanded: true })], "ArrowRight"))
      .toBeNull();
    expect(getKonquerorTreeKeyboardAction("file", [row({ nodeId: "file" })], "ArrowRight")).toBeNull();
  });

  it("collapses an expanded directory before selecting its parent on a second Left", () => {
    expect(getKonquerorTreeKeyboardAction("folder", expandedTree, "ArrowLeft"))
      .toEqual({ type: "collapse", nodeId: "folder" });
    expect(getKonquerorTreeKeyboardAction("child-b", [
      row({ nodeId: "folder", expandable: true, expanded: false, hasChildren: true }),
      row({ nodeId: "child-b", parentId: "folder", depth: 1, expandable: true, expanded: false }),
    ], "ArrowLeft")).toEqual({ type: "select", nodeId: "folder" });
  });

  it("selects only a visible parent and never selects the unrendered projection root", () => {
    expect(getKonquerorTreeKeyboardAction("child-c", expandedTree, "ArrowLeft"))
      .toEqual({ type: "select", nodeId: "folder" });
    expect(getKonquerorTreeKeyboardAction("folder", expandedTree, "ArrowLeft")).toEqual({ type: "collapse", nodeId: "folder" });
    expect(getKonquerorTreeKeyboardAction("top-level", [row({ nodeId: "top-level", parentId: "projection-root" })], "ArrowLeft"))
      .toBeNull();
    expect(getKonquerorTreeKeyboardAction("orphan", [row({ nodeId: "orphan", parentId: "hidden-parent", depth: 1 })], "ArrowLeft"))
      .toBeNull();
  });

  it("uses no action without an exact current visible row", () => {
    expect(getKonquerorTreeKeyboardAction(null, expandedTree, "ArrowRight")).toBeNull();
    expect(getKonquerorTreeKeyboardAction("missing", expandedTree, "ArrowLeft")).toBeNull();
  });
});
