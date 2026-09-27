import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";
import { getVfsNodeById, getVfsPathForNode, listVfsDirectory } from "../vfs/queries";
import type { VfsNode, VfsNodeId, VfsState } from "../vfs/types";

export interface ShellVfsWalkEntry {
  readonly node: VfsNode;
  readonly path: string;
}

export function walkVfsTree(
  state: VfsState,
  startNodeId: VfsNodeId,
): ShellResult<readonly ShellVfsWalkEntry[]> {
  const visited = new Set<VfsNodeId>();
  const entries: ShellVfsWalkEntry[] = [];

  const visit = (nodeId: VfsNodeId): ShellResult<undefined> => {
    if (visited.has(nodeId)) {
      return shellFail(createShellError("VFS_ERROR", "filesystem tree is not valid"));
    }

    const node = getVfsNodeById(state, nodeId);

    if (!node.ok) {
      return shellFail(createShellError("VFS_ERROR", "filesystem tree is not valid", { cause: node.error }));
    }

    const path = getVfsPathForNode(state, nodeId);

    if (!path.ok) {
      return shellFail(createShellError("VFS_ERROR", "filesystem tree is not valid", { cause: path.error }));
    }

    visited.add(nodeId);
    entries.push({ node: node.value, path: path.value });

    if (node.value.kind === "file") {
      return shellOk(undefined);
    }

    const children = listVfsDirectory(state, path.value);

    if (!children.ok) {
      return shellFail(createShellError("VFS_ERROR", "filesystem tree is not valid", { cause: children.error }));
    }

    for (const child of children.value) {
      const result = visit(child.id);

      if (!result.ok) {
        return result;
      }
    }

    return shellOk(undefined);
  };

  const result = visit(startNodeId);

  return result.ok ? shellOk(entries) : result;
}
