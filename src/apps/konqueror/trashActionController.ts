import type { VfsError } from "../../vfs/errors";
import type { VfsDeleteResult, VfsNodeId, VfsState } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorClipboardState } from "./clipboardTypes";
import type { KonquerorCommandEnvironment } from "./commandTypes";
import type { KonquerorConfirmationState } from "./fileOperationTypes";
import { shouldClearClipboardAfterMoveToTrash } from "./moveToTrashController";

export type KonquerorTrashActionOperations = Pick<
  VfsContextValue,
  "restoreNodesFromTrash" | "deleteNodesPermanently" | "emptyTrash"
>;

export type KonquerorRestoreTrashEntriesResult =
  | { readonly ok: true; readonly restoredNodeIds: readonly VfsNodeId[]; readonly statusMessage: string }
  | { readonly ok: false; readonly error: VfsError };

export type KonquerorTrashDeleteResult =
  | { readonly ok: true; readonly deletedNodeIds: readonly VfsNodeId[]; readonly shouldClearClipboard: boolean; readonly statusMessage: string }
  | { readonly ok: false; readonly error: VfsError };

const failRestore = (error: VfsError): KonquerorRestoreTrashEntriesResult => ({ ok: false, error });
const failDelete = (error: VfsError): KonquerorTrashDeleteResult => ({ ok: false, error });

const isClipboardInsideDeletedTree = (
  state: VfsState,
  clipboardState: KonquerorClipboardState,
  deletedRootIds: readonly VfsNodeId[],
): boolean => shouldClearClipboardAfterMoveToTrash(state, clipboardState, deletedRootIds);

export function restoreKonquerorTrashEntries(
  state: VfsState,
  nodeIds: readonly VfsNodeId[],
  operations: KonquerorTrashActionOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorRestoreTrashEntriesResult {
  if (nodeIds.length === 0) return failRestore({ code: "NOT_IN_TRASH", message: "No Trash entry is selected." });
  const restored = operations.restoreNodesFromTrash(nodeIds, { now: environment.now() });
  if (!restored.ok) return failRestore(restored.error);
  return {
    ok: true,
    restoredNodeIds: restored.value.map((node) => node.id),
    statusMessage: nodeIds.length === 1 ? `Restored ${restored.value[0]?.name ?? "item"}` : `Restored ${nodeIds.length} items`,
  };
}

export function deleteKonquerorTrashEntriesPermanently(
  state: VfsState,
  confirmationState: KonquerorConfirmationState,
  clipboardState: KonquerorClipboardState,
  operations: KonquerorTrashActionOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorTrashDeleteResult {
  if (confirmationState.kind !== "delete-permanently" || confirmationState.targetNodeIds.length === 0) {
    return failDelete({ code: "NOT_IN_TRASH", message: "No permanent delete confirmation is open." });
  }
  const deleted = operations.deleteNodesPermanently(confirmationState.targetNodeIds, { now: environment.now() });
  if (!deleted.ok) return failDelete(deleted.error);
  return {
    ok: true,
    deletedNodeIds: deleted.value.deletedNodeIds,
    shouldClearClipboard: isClipboardInsideDeletedTree(state, clipboardState, confirmationState.targetNodeIds),
    statusMessage: confirmationState.targetNodeIds.length === 1
      ? `Permanently deleted ${confirmationState.targetLabel}`
      : `Permanently deleted ${confirmationState.targetNodeIds.length} items`,
  };
}

export function emptyKonquerorTrash(
  state: VfsState,
  clipboardState: KonquerorClipboardState,
  operations: KonquerorTrashActionOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorTrashDeleteResult {
  const trash = state.nodesById[state.specialLocations.trash];
  const deletedRoots = trash?.kind === "directory" ? trash.childIds : [];
  const emptied = operations.emptyTrash({ now: environment.now() });
  if (!emptied.ok) return failDelete(emptied.error);
  return {
    ok: true,
    deletedNodeIds: emptied.value.deletedNodeIds,
    shouldClearClipboard: isClipboardInsideDeletedTree(state, clipboardState, deletedRoots),
    statusMessage: "Trash emptied",
  };
}

export function getDeletedNodeIds(result: VfsDeleteResult): readonly VfsNodeId[] {
  return result.deletedNodeIds;
}
