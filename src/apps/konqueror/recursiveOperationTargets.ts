import { createVfsError } from "../../vfs/errors";
import { fail, ok, type VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";

/**
 * Removes selected nodes that are already covered by a selected directory
 * ancestor, preserving the caller's current visible presentation order.
 */
export function normalizeKonquerorRecursiveOperationTargets(
  state: VfsState,
  orderedSelectedNodeIds: readonly VfsNodeId[],
): VfsResult<readonly VfsNodeId[]> {
  const seen = new Set<VfsNodeId>();
  const selectedNodeIds = orderedSelectedNodeIds.filter((nodeId) => {
    if (seen.has(nodeId)) {
      return false;
    }

    seen.add(nodeId);
    return true;
  });
  const selected = new Set(selectedNodeIds);

  for (const nodeId of selectedNodeIds) {
    if (!state.nodesById[nodeId]) {
      return fail(createVfsError("NOT_FOUND", "The selected item no longer exists.", { nodeId }));
    }
  }

  const hasSelectedAncestor = (nodeId: VfsNodeId): VfsResult<boolean> => {
    let current = state.nodesById[nodeId];
    const ancestry = new Set<VfsNodeId>();

    while (current?.parentId) {
      if (ancestry.has(current.id)) {
        return fail(createVfsError("INVALID_PATH", "VFS parent cycle detected.", { nodeId: current.id }));
      }

      ancestry.add(current.id);

      const parent = state.nodesById[current.parentId];
      if (!parent) {
        return fail(createVfsError("NOT_FOUND", "The selected item's parent no longer exists.", { nodeId }));
      }

      if (ancestry.has(parent.id)) {
        return fail(createVfsError("INVALID_PATH", "VFS parent cycle detected.", { nodeId: parent.id }));
      }

      if (selected.has(parent.id)) {
        return ok(true);
      }

      current = parent;
    }

    return ok(false);
  };

  const normalized: VfsNodeId[] = [];
  for (const nodeId of selectedNodeIds) {
    const descendant = hasSelectedAncestor(nodeId);
    if (!descendant.ok) {
      return descendant;
    }

    if (!descendant.value) {
      normalized.push(nodeId);
    }
  }

  return ok(normalized);
}
