import type { VfsNodeId, VfsState } from "../../vfs/types";
import { isVfsTrashRoot } from "../../vfs/trashPaths";
import { sortKonquerorEntries, type KonquerorSortDescriptor } from "./directoryViewModel";

export interface KonquerorVisibleTreeRow {
  readonly nodeId: VfsNodeId;
  readonly parentId: VfsNodeId;
  readonly depth: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly hasChildren: boolean;
  readonly isLastSibling: boolean;
  readonly ancestorContinuation: readonly boolean[];
}

const getDirectoryChildren = (state: VfsState, nodeId: VfsNodeId) => {
  const node = state.nodesById[nodeId];
  return node?.kind === "directory"
    ? node.childIds
      .map((childId) => state.nodesById[childId])
      .filter((child): child is NonNullable<typeof child> => child !== undefined)
      .filter((child) => isVfsTrashRoot(state, nodeId) || !child.name.startsWith("."))
    : [];
};

export function getKonquerorVisibleTreeRows(
  state: VfsState,
  rootNodeId: VfsNodeId,
  sort: KonquerorSortDescriptor,
  expandedTreeNodeIds: readonly VfsNodeId[],
): readonly KonquerorVisibleTreeRow[] {
  const expanded = new Set(expandedTreeNodeIds);
  const rows: KonquerorVisibleTreeRow[] = [];
  const visit = (parentId: VfsNodeId, depth: number, ancestorContinuation: readonly boolean[], ancestors: ReadonlySet<VfsNodeId>) => {
    const siblings = sortKonquerorEntries(getDirectoryChildren(state, parentId), sort);
    siblings.forEach((node, index) => {
      if (ancestors.has(node.id)) return;
      const children = node.kind === "directory" ? getDirectoryChildren(state, node.id) : [];
      const expandable = node.kind === "directory";
      const hasChildren = children.length > 0;
      const expandedNode = expandable && expanded.has(node.id);
      const isLastSibling = index === siblings.length - 1;
      rows.push({ nodeId: node.id, parentId, depth, expandable, expanded: expandedNode, hasChildren, isLastSibling, ancestorContinuation });
      if (expandedNode && hasChildren) {
        visit(node.id, depth + 1, [...ancestorContinuation, !isLastSibling], new Set([...ancestors, node.id]));
      }
    });
  };
  visit(rootNodeId, 0, [], new Set([rootNodeId]));
  return rows;
}

export function getKonquerorExpandableTreeNodeIds(state: VfsState): readonly VfsNodeId[] {
  return Object.values(state.nodesById)
    .filter((node) => node.kind === "directory")
    .map((node) => node.id);
}
