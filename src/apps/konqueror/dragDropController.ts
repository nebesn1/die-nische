import { createVfsError, type VfsError } from "../../vfs/errors";
import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import { fail, ok, type VfsResult } from "../../vfs/result";
import { isProtectedVfsNode, isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorCommandEnvironment } from "./commandTypes";
import { getKonquerorCreateChildAvailability } from "./createChildCapability";
import { normalizeKonquerorRecursiveOperationTargets } from "./recursiveOperationTargets";

export type KonquerorDropAction = "move" | "copy" | "link" | "cancel";

export type KonquerorDragOperationPlan = {
  readonly rawDraggedNodeIds: readonly VfsNodeId[];
  readonly operationRootNodeIds: readonly VfsNodeId[];
  readonly sourceParentIdsByNodeId: Readonly<Record<VfsNodeId, VfsNodeId>>;
};

export type KonquerorDropActionRequest = KonquerorDragOperationPlan & {
  readonly requestId: number;
  /** Source instance owns execution; target may be another visible Konqueror. */
  readonly ownerWindowId: string;
  readonly targetWindowId: string;
  readonly targetFolderNodeId: VfsNodeId;
  readonly clientX: number;
  readonly clientY: number;
};

export type KonquerorDragDropOperations = Pick<VfsContextValue, "copyNodes" | "createLinks" | "moveNodes">;

export type KonquerorDragDropResult =
  | { readonly ok: true; readonly statusMessage: string; readonly operation: Exclude<KonquerorDropAction, "cancel">; readonly nodeIds: readonly VfsNodeId[] }
  | { readonly ok: false; readonly error: VfsError };

const failResult = (error: VfsError): KonquerorDragDropResult => ({ ok: false, error });

export function canKonquerorAcceptFileDrop(state: VfsState, nodeId: VfsNodeId): boolean {
  return getKonquerorCreateChildAvailability(state, nodeId).canCreateChild;
}

export function canKonquerorDragResource(state: VfsState, nodeId: VfsNodeId): boolean {
  const node = state.nodesById[nodeId];
  return node !== undefined && node.parentId !== null && !isVfsNodeInsideTrash(state, nodeId) && !isProtectedVfsNode(state, nodeId);
}

/** Freezes visible-order drag sources and their operation roots without mutating selection or clipboard. */
export function buildKonquerorDragOperationPlan(
  state: VfsState,
  rawDraggedNodeIds: readonly VfsNodeId[],
): VfsResult<KonquerorDragOperationPlan> {
  const operationRoots = normalizeKonquerorRecursiveOperationTargets(state, rawDraggedNodeIds);
  if (!operationRoots.ok) return operationRoots;

  for (const nodeId of rawDraggedNodeIds) {
    const node = getVfsNodeById(state, nodeId);
    if (!node.ok) return node;
    if (!canKonquerorDragResource(state, nodeId)) {
      return fail(createVfsError("INVALID_DESTINATION", "This item cannot be dragged.", { nodeId }));
    }
  }

  const sourceParentIdsByNodeId: Record<VfsNodeId, VfsNodeId> = {};
  for (const nodeId of operationRoots.value) {
    const node = getVfsNodeById(state, nodeId);
    if (!node.ok || node.value.parentId === null) return fail(createVfsError("NOT_FOUND", "A dragged item no longer exists.", { nodeId }));
    sourceParentIdsByNodeId[nodeId] = node.value.parentId;
  }

  return ok({ rawDraggedNodeIds, operationRootNodeIds: operationRoots.value, sourceParentIdsByNodeId });
}

/** Shared copy/move execution for drag requests and explicit destination requests. */
export function executeKonquerorFileTransfer(
  state: VfsState,
  plan: KonquerorDragOperationPlan,
  action: "move" | "copy",
  targetFolderNodeId: VfsNodeId,
  operations: Pick<KonquerorDragDropOperations, "copyNodes" | "moveNodes">,
  environment: KonquerorCommandEnvironment,
): KonquerorDragDropResult {
  const targetAvailability = getKonquerorCreateChildAvailability(state, targetFolderNodeId);
  if (!targetAvailability.canCreateChild || targetAvailability.error) {
    return failResult(targetAvailability.error ?? createVfsError("INVALID_DESTINATION", "The selected destination is not valid."));
  }

  const targetPath = getVfsPathForNode(state, targetFolderNodeId);
  if (!targetPath.ok) return failResult(targetPath.error);

  const sourcePaths: string[] = [];
  for (const nodeId of plan.operationRootNodeIds) {
    const node = getVfsNodeById(state, nodeId);
    if (!node.ok || node.value.parentId !== plan.sourceParentIdsByNodeId[nodeId]) {
      return failResult(node.ok
        ? createVfsError("NOT_FOUND", "A selected item is no longer in its original folder.", { nodeId })
        : node.error);
    }
    const sourcePath = getVfsPathForNode(state, nodeId);
    if (!sourcePath.ok) return failResult(sourcePath.error);
    sourcePaths.push(sourcePath.value);
  }

  const result = action === "copy"
    ? operations.copyNodes(sourcePaths, targetPath.value, { now: environment.now() })
    : operations.moveNodes(sourcePaths, targetPath.value, { now: environment.now() });
  if (!result.ok) return failResult(result.error);

  return {
    ok: true,
    operation: action,
    nodeIds: result.value.map((node) => node.id),
    statusMessage: `${action === "copy" ? "Copied" : "Moved"} ${plan.operationRootNodeIds.length === 1 ? "item" : `${plan.operationRootNodeIds.length} items`} to ${state.nodesById[targetFolderNodeId]?.name || "folder"}`,
  };
}

export function executeKonquerorDropAction(
  state: VfsState,
  request: KonquerorDropActionRequest,
  action: "move" | "copy" | "link",
  operations: KonquerorDragDropOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorDragDropResult {
  const targetAvailability = getKonquerorCreateChildAvailability(state, request.targetFolderNodeId);
  if (!targetAvailability.canCreateChild || targetAvailability.error) {
    return failResult(targetAvailability.error ?? createVfsError("INVALID_DESTINATION", "The selected destination is not valid."));
  }

  if (action === "link") {
    const result = operations.createLinks(request.targetFolderNodeId, request.rawDraggedNodeIds, { now: environment.now() });
    if (!result.ok) return failResult(result.error);
    return {
      ok: true,
      operation: action,
      nodeIds: result.value.map((node) => node.id),
      statusMessage: `Created ${result.value.length === 1 ? "link" : `${result.value.length} links`} in ${state.nodesById[request.targetFolderNodeId]?.name || "folder"}`,
    };
  }

  return executeKonquerorFileTransfer(
    state,
    request,
    action,
    request.targetFolderNodeId,
    operations,
    environment,
  );
}
