import { createVfsError, type VfsError } from "../../vfs/errors";
import { getVfsPathForNode } from "../../vfs/queries";
import { fail, ok, type VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorCommandEnvironment } from "./commandTypes";
import { getKonquerorCreateChildAvailability } from "./createChildCapability";
import {
  buildKonquerorDragOperationPlan,
  canKonquerorDragResource,
  executeKonquerorFileTransfer,
  type KonquerorDragOperationPlan,
} from "./dragDropController";
import { resolveKonquerorAbsoluteDirectoryLocation } from "./navigationController";
import type { KonquerorDirectTransferKind, KonquerorDirectTransferRequest, KonquerorDirectTransferSourceKind } from "./directTransferTypes";

export type KonquerorDirectTransferAvailability = {
  readonly canTransfer: boolean;
  readonly title: string;
};

export type KonquerorDirectTransferOperations = Pick<VfsContextValue, "copyNodes" | "moveNodes">;

export type KonquerorDirectTransferResult =
  | { readonly ok: true; readonly statusMessage: string; readonly operation: "move" | "copy"; readonly nodeIds: readonly VfsNodeId[] }
  | { readonly ok: false; readonly error: VfsError };

const unavailable = (title: string): KonquerorDirectTransferAvailability => ({ canTransfer: false, title });

export function getKonquerorDirectTransferAvailability(
  state: VfsState,
  sourceNodeIds: readonly VfsNodeId[],
  isBlocked: boolean,
): KonquerorDirectTransferAvailability {
  if (isBlocked) return unavailable("Finish the current operation first");
  if (sourceNodeIds.length === 0) return unavailable("Select one or more files or folders first");

  for (const nodeId of sourceNodeIds) {
    if (!canKonquerorDragResource(state, nodeId)) {
      return unavailable("The selected items cannot be copied or moved");
    }
  }

  const plan = buildKonquerorDragOperationPlan(state, sourceNodeIds);
  return plan.ok && plan.value.operationRootNodeIds.length > 0
    ? { canTransfer: true, title: "Copy or move selected files" }
    : unavailable("The selected items cannot be copied or moved");
}

export function createKonquerorDirectTransferRequest(
  state: VfsState,
  kind: KonquerorDirectTransferKind,
  ownerWindowId: string,
  sourceLocationNodeId: VfsNodeId,
  sourceNodeIds: readonly VfsNodeId[],
  sourceKind: KonquerorDirectTransferSourceKind = "selection",
): VfsResult<KonquerorDirectTransferRequest> {
  const plan = buildKonquerorDragOperationPlan(state, sourceNodeIds);
  if (!plan.ok) return plan;
  if (plan.value.operationRootNodeIds.length === 0) {
    return fail(createVfsError("NOT_FOUND", "Select one or more files or folders first."));
  }
  return ok({ ...plan.value, kind, sourceKind, ownerWindowId, sourceLocationNodeId });
}

export function getKonquerorDirectTransferInitialDestination(
  state: VfsState,
  sourceLocationNodeId: VfsNodeId,
): VfsResult<string> {
  return getVfsPathForNode(state, sourceLocationNodeId);
}

/** Resolves a single absolute VFS directory, deliberately excluding URL and relative-path parsing. */
export function resolveKonquerorDirectTransferDestination(
  state: VfsState,
  destinationDraft: string,
): VfsResult<{ readonly nodeId: VfsNodeId; readonly path: string }> {
  const target = resolveKonquerorAbsoluteDirectoryLocation(state, destinationDraft);
  if (!target.ok) return target;

  const availability = getKonquerorCreateChildAvailability(state, target.value.node.id);
  if (!availability.canCreateChild || availability.error) {
    return fail(availability.error ?? createVfsError("INVALID_DESTINATION", "The selected destination is not valid."));
  }

  return ok({ nodeId: target.value.node.id, path: target.value.path });
}

export function submitKonquerorDirectTransfer(
  state: VfsState,
  request: KonquerorDirectTransferRequest,
  destinationDraft: string,
  operations: KonquerorDirectTransferOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorDirectTransferResult {
  const destination = resolveKonquerorDirectTransferDestination(state, destinationDraft);
  if (!destination.ok) return { ok: false, error: destination.error };

  const transferred = executeKonquerorFileTransfer(
    state,
    request as KonquerorDragOperationPlan,
    request.kind,
    destination.value.nodeId,
    operations,
    environment,
  );
  return !transferred.ok
    ? transferred
    : { ...transferred, operation: request.kind };
}
