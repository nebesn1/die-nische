import { getVfsPathForNode, getVfsNodeById } from "../../vfs/queries";
import { ok, fail, type VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { formatKFindLocation } from "./locationModel";

export function getKFindSaveFilename(filename: string, autoExtension: boolean): string {
  return autoExtension && !filename.toLowerCase().endsWith(".txt") ? `${filename}.txt` : filename;
}

/** Resolves displayed stable result ids to their current VFS URLs atomically before any write. */
export function serializeKFindResults(state: VfsState, resultNodeIds: readonly VfsNodeId[]): VfsResult<string> {
  const urls: string[] = [];
  for (const nodeId of resultNodeIds) {
    const node = getVfsNodeById(state, nodeId);
    if (!node.ok) return fail(node.error);
    const path = getVfsPathForNode(state, node.value.id);
    if (!path.ok) return fail(path.error);
    urls.push(formatKFindLocation(path.value));
  }
  return ok(urls.length === 0 ? "" : `${urls.join("\n")}\n`);
}
