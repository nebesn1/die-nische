import { createVfsError } from "../../vfs/errors";
import { fail, ok, type VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { normalizeKonquerorSelection } from "./selectionModel";
import type { KonquerorClipboardEntry } from "./clipboardTypes";
import { normalizeKonquerorRecursiveOperationTargets } from "./recursiveOperationTargets";

export interface KonquerorClipboardEntryPlan {
  readonly entries: readonly KonquerorClipboardEntry[];
  readonly displayNodeIds: readonly VfsNodeId[];
}

/** Builds an immutable, visible-order clipboard snapshot without mutating selection or VFS. */
export function buildKonquerorClipboardEntryPlan(
  state: VfsState,
  orderedSelectedNodeIds: readonly VfsNodeId[],
): VfsResult<KonquerorClipboardEntryPlan> {
  const displayNodeIds = normalizeKonquerorSelection(orderedSelectedNodeIds);
  const operationRoots = normalizeKonquerorRecursiveOperationTargets(state, displayNodeIds);
  if (!operationRoots.ok) {
    return operationRoots;
  }

  const entries: KonquerorClipboardEntry[] = [];
  for (const nodeId of operationRoots.value) {
    const node = state.nodesById[nodeId];
    if (!node) {
      return fail(createVfsError("NOT_FOUND", "The selected item no longer exists.", { nodeId }));
    }

    if (node.parentId === null) {
      return fail(createVfsError("ROOT_OPERATION_FORBIDDEN", "The root directory cannot be copied or moved.", { nodeId }));
    }

    entries.push({ nodeId, sourceParentId: node.parentId });
  }

  return ok({ entries, displayNodeIds });
}
