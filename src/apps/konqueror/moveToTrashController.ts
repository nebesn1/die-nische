import type { VfsError } from "../../vfs/errors";
import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import { isVfsNodeDescendantOf } from "../../vfs/tree";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorClipboardState } from "./clipboardTypes";
import type { KonquerorCommandEnvironment } from "./commandTypes";
import type { KonquerorConfirmationState } from "./fileOperationTypes";

export type KonquerorMoveToTrashOperations = Pick<VfsContextValue, "moveNodesToTrash">;
export type KonquerorMoveToTrashResult =
  | { readonly ok: true; readonly trashedNodeIds: readonly VfsNodeId[]; readonly shouldClearClipboard: boolean; readonly statusMessage: string }
  | { readonly ok: false; readonly error: VfsError };

const fail = (error: VfsError): KonquerorMoveToTrashResult => ({ ok: false, error });

export function shouldClearClipboardAfterMoveToTrash(
  state: VfsState,
  clipboardState: KonquerorClipboardState,
  trashedNodeIds: readonly VfsNodeId[],
): boolean {
  return clipboardState.kind === "items" && clipboardState.entries.some(({ nodeId: clipboardNodeId }) =>
    trashedNodeIds.some((trashedNodeId) => clipboardNodeId === trashedNodeId || isVfsNodeDescendantOf(state, clipboardNodeId, trashedNodeId)),
  );
}

export function submitKonquerorMoveToTrash(
  state: VfsState,
  confirmationState: KonquerorConfirmationState,
  clipboardState: KonquerorClipboardState,
  operations: KonquerorMoveToTrashOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorMoveToTrashResult {
  if (confirmationState.kind !== "move-to-trash" || confirmationState.operationRootNodeIds.length === 0) {
    return fail({ code: "NOT_FOUND", message: "No Move to Trash confirmation is open." });
  }

  const sourcePaths: string[] = [];
  for (const nodeId of confirmationState.operationRootNodeIds) {
    const node = getVfsNodeById(state, nodeId);
    if (!node.ok) return fail(node.error);
    const path = getVfsPathForNode(state, node.value.id);
    if (!path.ok) return fail(path.error);
    sourcePaths.push(path.value);
  }
  const moved = operations.moveNodesToTrash(sourcePaths, { now: environment.now() });
  if (!moved.ok) return fail(moved.error);

  return {
    ok: true,
    trashedNodeIds: moved.value.map((node) => node.id),
    shouldClearClipboard: shouldClearClipboardAfterMoveToTrash(state, clipboardState, confirmationState.targetNodeIds),
    statusMessage: confirmationState.targetNodeIds.length === 1
      ? `Moved ${confirmationState.targetLabel} to the Trash`
      : `Moved ${confirmationState.targetNodeIds.length} items to the Trash`,
  };
}
