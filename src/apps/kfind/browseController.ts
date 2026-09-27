import { resolveVfsDialogTargetDirectory } from "../../vfs/vfsDialogController";
import type { VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";

/** Resolves the selected child directory, or the displayed directory when none is selected. */
export function selectKFindBrowseDirectory(
  state: VfsState,
  currentDirectoryNodeId: VfsNodeId,
  selectedDirectoryNodeId: VfsNodeId | null = null,
): VfsResult<VfsNodeId> {
  return resolveVfsDialogTargetDirectory(state, currentDirectoryNodeId, selectedDirectoryNodeId);
}
