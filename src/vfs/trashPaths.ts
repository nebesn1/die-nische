import type { VfsNode, VfsNodeId, VfsState } from "./types";

export const VFS_TRASH_FILES_PATH = "/home/user/.local/share/Trash/files";
export const KONQUEROR_TRASH_LOCATION = "trash:/";

export function isVfsTrashRoot(state: VfsState, nodeId: VfsNodeId): boolean {
  return nodeId === state.specialLocations.trash;
}

export function isVfsNodeInsideTrash(state: VfsState, nodeId: VfsNodeId): boolean {
  let current: VfsNode | undefined = state.nodesById[nodeId];
  const seen = new Set<VfsNodeId>();

  while (current) {
    if (seen.has(current.id)) {
      return false;
    }

    if (current.id === state.specialLocations.trash) {
      return true;
    }

    seen.add(current.id);
    current = current.parentId === null ? undefined : state.nodesById[current.parentId];
  }

  return false;
}

export function getVfsTrashRelativePath(state: VfsState, nodeId: VfsNodeId): string | null {
  if (!isVfsNodeInsideTrash(state, nodeId)) {
    return null;
  }

  const segments: string[] = [];
  let current: VfsNode | undefined = state.nodesById[nodeId];
  const seen = new Set<VfsNodeId>();

  while (current && current.id !== state.specialLocations.trash) {
    if (seen.has(current.id)) {
      return null;
    }

    seen.add(current.id);
    segments.push(current.name);
    current = current.parentId === null ? undefined : state.nodesById[current.parentId];
  }

  return current ? segments.reverse().join("/") : null;
}

export function getKonquerorTrashLocation(state: VfsState, nodeId: VfsNodeId): string | null {
  const relativePath = getVfsTrashRelativePath(state, nodeId);

  return relativePath === null
    ? null
    : relativePath.length === 0
    ? KONQUEROR_TRASH_LOCATION
    : `${KONQUEROR_TRASH_LOCATION}${relativePath}`;
}
