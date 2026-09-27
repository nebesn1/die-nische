import { createKonsoleWorkingDirectoryIntent, type KonsoleWorkingDirectoryIntent } from "../konsole/launchIntent";
import { createVfsError } from "../../vfs/errors";
import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import { fail, ok, type VfsResult } from "../../vfs/result";
import { isVfsNodeInsideTrash } from "../../vfs/trashPaths";
import type { VfsNodeId, VfsState } from "../../vfs/types";

/** Resolves the live directory identity at action time, not from a rendered label or URL. */
export function planKonquerorOpenTerminalHere(
  state: VfsState,
  directoryNodeId: VfsNodeId,
): VfsResult<KonsoleWorkingDirectoryIntent> {
  const directory = getVfsNodeById(state, directoryNodeId);

  if (!directory.ok) {
    return directory;
  }

  if (directory.value.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "Open Terminal Here requires a directory.", { nodeId: directoryNodeId }));
  }

  if (isVfsNodeInsideTrash(state, directory.value.id)) {
    return fail(createVfsError("INVALID_DESTINATION", "The Trash is not a terminal working directory.", { nodeId: directoryNodeId }));
  }

  const workingDirectory = getVfsPathForNode(state, directory.value.id);

  return workingDirectory.ok
    ? ok(createKonsoleWorkingDirectoryIntent(workingDirectory.value))
    : workingDirectory;
}
