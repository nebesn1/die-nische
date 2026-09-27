import { createVfsError } from "./errors";
import { validateVfsNodeName } from "./path";
import { getVfsNodeById } from "./queries";
import { fail, ok, type VfsResult } from "./result";
import type { VfsDirectoryNode, VfsNodeId, VfsState } from "./types";

export { isVfsNodeInsideTrash, isVfsTrashRoot } from "./trashPaths";

export function isProtectedVfsNode(state: VfsState, nodeId: VfsNodeId): boolean {
  return nodeId === state.rootId || Object.values(state.specialLocations).includes(nodeId);
}

export function getVfsDescendantIds(state: VfsState, nodeId: VfsNodeId): VfsResult<readonly VfsNodeId[]> {
  const root = getVfsNodeById(state, nodeId);

  if (!root.ok) {
    return root;
  }

  if (root.value.kind !== "directory") {
    return ok([]);
  }

  const descendants: VfsNodeId[] = [];
  const seen = new Set<VfsNodeId>([nodeId]);

  const visit = (directory: VfsDirectoryNode): VfsResult<void> => {
    for (const childId of directory.childIds) {
      if (seen.has(childId)) {
        return fail(createVfsError("INVALID_PATH", "VFS child cycle detected.", { nodeId: childId }));
      }

      const child = state.nodesById[childId];

      if (!child) {
        return fail(createVfsError("NOT_FOUND", "Directory child was not found.", { nodeId: childId }));
      }

      seen.add(childId);
      descendants.push(childId);

      if (child.kind === "directory") {
        const nested = visit(child);

        if (!nested.ok) {
          return nested;
        }
      }
    }

    return ok(undefined);
  };

  const visited = visit(root.value);

  return visited.ok ? ok(descendants) : visited;
}

export function isVfsNodeDescendantOf(
  state: VfsState,
  nodeId: VfsNodeId,
  possibleAncestorId: VfsNodeId,
): boolean {
  let current = state.nodesById[nodeId];
  const seen = new Set<VfsNodeId>();

  while (current?.parentId) {
    if (seen.has(current.id)) {
      return false;
    }

    seen.add(current.id);

    if (current.parentId === possibleAncestorId) {
      return true;
    }

    current = state.nodesById[current.parentId];
  }

  return false;
}

const splitNameForConflictSuffix = (name: string): { readonly base: string; readonly extension: string } => {
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex <= 0) {
    return {
      base: name,
      extension: "",
    };
  }

  return {
    base: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
};

export function createAvailableVfsName(state: VfsState, directoryId: VfsNodeId, desiredName: string): string {
  const directory = state.nodesById[directoryId];

  if (!directory || directory.kind !== "directory") {
    return desiredName;
  }

  const childNames = new Set(directory.childIds.map((childId) => state.nodesById[childId]?.name).filter(Boolean));

  if (!childNames.has(desiredName)) {
    return desiredName;
  }

  const { base, extension } = splitNameForConflictSuffix(desiredName);
  let suffix = 1;
  let candidate = `${base} (${suffix})${extension}`;

  while (childNames.has(candidate)) {
    suffix += 1;
    candidate = `${base} (${suffix})${extension}`;
  }

  return candidate;
}

export function validateVfsDestinationName(name: string): VfsResult<string> {
  return validateVfsNodeName(name);
}
