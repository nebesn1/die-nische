import type { VfsNodeId } from "../../vfs/types";
import type { KonquerorVisibleTreeRow } from "./treeProjection";

export type KonquerorTreeHierarchyKey = "ArrowLeft" | "ArrowRight";

export type KonquerorTreeKeyboardAction =
  | { readonly type: "expand"; readonly nodeId: VfsNodeId }
  | { readonly type: "collapse"; readonly nodeId: VfsNodeId }
  | { readonly type: "select"; readonly nodeId: VfsNodeId };

/** Plans classic Tree hierarchy keys from the current visible projection only. */
export function getKonquerorTreeKeyboardAction(
  currentNodeId: VfsNodeId | null,
  visibleTreeRows: readonly KonquerorVisibleTreeRow[],
  key: KonquerorTreeHierarchyKey,
): KonquerorTreeKeyboardAction | null {
  if (currentNodeId === null) {
    return null;
  }

  const currentIndex = visibleTreeRows.findIndex((row) => row.nodeId === currentNodeId);
  const currentRow = currentIndex === -1 ? null : visibleTreeRows[currentIndex] ?? null;
  if (currentRow === null) {
    return null;
  }

  if (key === "ArrowRight") {
    if (!currentRow.expandable) {
      return null;
    }

    if (!currentRow.expanded) {
      return { type: "expand", nodeId: currentRow.nodeId };
    }

    const firstVisibleDirectChild = visibleTreeRows
      .slice(currentIndex + 1)
      .find((row) => row.parentId === currentRow.nodeId);
    return firstVisibleDirectChild ? { type: "select", nodeId: firstVisibleDirectChild.nodeId } : null;
  }

  if (currentRow.expandable && currentRow.expanded) {
    return { type: "collapse", nodeId: currentRow.nodeId };
  }

  const visibleParent = visibleTreeRows.find((row) => row.nodeId === currentRow.parentId);
  return visibleParent ? { type: "select", nodeId: visibleParent.nodeId } : null;
}
