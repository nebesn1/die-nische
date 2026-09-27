import { createVfsError, type VfsError } from "../../vfs/errors";
import { getVfsNodeById } from "../../vfs/queries";
import { isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsNodeId, VfsState } from "../../vfs/types";

export type KonquerorCreateChildAvailability = {
  readonly canCreateChild: boolean;
  readonly title: string;
  readonly error: VfsError | null;
};

/** Creates only in a live, ordinary VFS directory; Trash is a read-only presentation. */
export function getKonquerorCreateChildAvailability(
  state: VfsState,
  parentNodeId: VfsNodeId,
): KonquerorCreateChildAvailability {
  const parent = getVfsNodeById(state, parentNodeId);

  if (!parent.ok) {
    return {
      canCreateChild: false,
      title: "The target folder no longer exists.",
      error: createVfsError("INVALID_DESTINATION", "The target folder no longer exists.", { nodeId: parentNodeId }),
    };
  }

  if (parent.value.kind !== "directory") {
    return {
      canCreateChild: false,
      title: "The target is not a folder.",
      error: createVfsError("NOT_DIRECTORY", "The target is not a folder.", { nodeId: parentNodeId }),
    };
  }

  if (isVfsNodeInsideTrash(state, parentNodeId)) {
    return {
      canCreateChild: false,
      title: "Items in the Trash are read-only",
      error: createVfsError("INVALID_DESTINATION", "Items in the Trash are read-only", { nodeId: parentNodeId }),
    };
  }

  return {
    canCreateChild: true,
    title: "Create Folder",
    error: null,
  };
}
