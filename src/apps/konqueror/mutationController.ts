import type { VfsError } from "../../vfs/errors";
import { joinVfsPath } from "../../vfs/path";
import { getVfsPathForNode } from "../../vfs/queries";
import type { VfsResult } from "../../vfs/result";
import type { VfsDirectoryNode, VfsNode, VfsNodeId, VfsState, VfsTextFileNode } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorCommandDialogState, KonquerorCommandEnvironment } from "./commandTypes";
import { getKonquerorCreateChildAvailability } from "./createChildCapability";

export type KonquerorMutationOperations = Pick<
  VfsContextValue,
  "createDirectory" | "createTextFile" | "renameNode"
>;

export type KonquerorMutationSuccess =
  | {
      readonly kind: "created";
      readonly nodeId: VfsNodeId;
      readonly currentPath: string;
    }
  | {
      readonly kind: "renamed";
      readonly nodeId: VfsNodeId;
      readonly currentPath: string;
      readonly renamedPath: string;
    };

export type KonquerorMutationControllerResult =
  | {
      readonly ok: true;
      readonly value: KonquerorMutationSuccess;
    }
  | {
      readonly ok: false;
      readonly error: VfsError;
    };

const fail = (error: VfsError): KonquerorMutationControllerResult => ({
  ok: false,
  error,
});

const ok = (value: KonquerorMutationSuccess): KonquerorMutationControllerResult => ({
  ok: true,
  value,
});

const getNodePath = (state: VfsState, nodeId: VfsNodeId): VfsResult<string> => getVfsPathForNode(state, nodeId);

const commitCreateResult = (
  result: VfsResult<VfsDirectoryNode | VfsTextFileNode>,
  currentPath: string,
): KonquerorMutationControllerResult => {
  if (!result.ok) {
    return fail(result.error);
  }

  return ok({
    kind: "created",
    nodeId: result.value.id,
    currentPath,
  });
};

export function submitKonquerorCommand(
  state: VfsState,
  dialogState: KonquerorCommandDialogState,
  operations: KonquerorMutationOperations,
  environment: KonquerorCommandEnvironment,
  currentPath: string,
): KonquerorMutationControllerResult {
  if (dialogState.kind === "closed") {
    return fail({
      code: "NOT_FOUND",
      message: "No Konqueror command is open.",
    });
  }

  if (dialogState.kind === "new-folder") {
    const createChildAvailability = getKonquerorCreateChildAvailability(state, dialogState.parentNodeId);

    if (!createChildAvailability.canCreateChild) {
      return fail(createChildAvailability.error!);
    }

    const parentPath = getNodePath(state, dialogState.parentNodeId);

    if (!parentPath.ok) {
      return fail(parentPath.error);
    }

    return commitCreateResult(
      operations.createDirectory(parentPath.value, dialogState.draftName, { now: environment.now() }),
      currentPath,
    );
  }

  if (dialogState.kind === "new-text-file") {
    const parentPath = getNodePath(state, dialogState.parentNodeId);

    if (!parentPath.ok) {
      return fail(parentPath.error);
    }

    return commitCreateResult(
      operations.createTextFile(parentPath.value, dialogState.draftName, "", {
        now: environment.now(),
        mimeType: "text/plain",
      }),
      currentPath,
    );
  }

  const targetPath = getNodePath(state, dialogState.targetNodeId);

  if (!targetPath.ok) {
    return fail(targetPath.error);
  }

  const renamed = operations.renameNode(targetPath.value, dialogState.draftName, { now: environment.now() });

  if (!renamed.ok) {
    return fail(renamed.error);
  }

  const renamedPath = buildRenamedPath(targetPath.value, renamed.value);

  return ok({
    kind: "renamed",
    nodeId: renamed.value.id,
    currentPath,
    renamedPath,
  });
}

export function buildRenamedPath(previousPath: string, renamedNode: VfsNode): string {
  const parentPath = previousPath === "/" ? "/" : previousPath.slice(0, previousPath.lastIndexOf("/")) || "/";

  return joinVfsPath(parentPath, renamedNode.name);
}
