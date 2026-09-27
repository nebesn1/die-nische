import { getVfsNodeById } from "../../vfs/queries";
import {
  getVfsDialogDirectory,
  getVfsDialogDirectoryNavigationTarget,
  getVfsDialogNode,
  getVfsDialogParentDirectoryId,
  type VfsDialogDirectory,
} from "../../vfs/vfsDialogController";
import { isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import type { KWriteDocumentState } from "./documentModel";

export type KWriteDialogDirectory = VfsDialogDirectory;

export function getKWriteDialogDirectory(
  state: VfsState,
  directoryNodeId: VfsNodeId,
): KWriteDialogDirectory | null {
  return getVfsDialogDirectory(state, directoryNodeId);
}

export function getKWriteDialogParentDirectoryId(state: VfsState, directoryNodeId: VfsNodeId): VfsNodeId | null {
  return getVfsDialogParentDirectoryId(state, directoryNodeId);
}

export function getKWriteDialogNode(
  state: VfsState,
  directoryNodeId: VfsNodeId,
  nodeId: VfsNodeId,
): VfsNode | null {
  return getVfsDialogNode(state, directoryNodeId, nodeId);
}

export function getKWriteDialogDirectoryNavigationTarget(
  state: VfsState,
  directoryNodeId: VfsNodeId,
  nodeId: VfsNodeId,
): VfsNodeId | null {
  return getVfsDialogDirectoryNavigationTarget(state, directoryNodeId, nodeId);
}

export function getKWriteInitialDialogDirectoryId(state: VfsState, document: KWriteDocumentState): VfsNodeId {
  if (document.nodeId !== null) {
    const node = getVfsNodeById(state, document.nodeId);

    if (node.ok && node.value.parentId) {
      const parent = getVfsNodeById(state, node.value.parentId);

      if (parent.ok && parent.value.kind === "directory" && !isVfsNodeInsideTrash(state, parent.value.id)) {
        return parent.value.id;
      }
    }
  }

  return state.specialLocations.home;
}
