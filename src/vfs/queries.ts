import { createVfsError } from "./errors";
import { isVfsTextFile } from "./fileContent";
import { normalizeVfsPath, splitVfsPath } from "./path";
import { fail, ok, type VfsResult } from "./result";
import type { VfsNode, VfsNodeId, VfsState, VfsTextFileNode, VfsTrashEntry } from "./types";

export function getVfsNodeById(state: VfsState, nodeId: VfsNodeId): VfsResult<VfsNode> {
  const node = state.nodesById[nodeId];

  if (!node) {
    return fail(createVfsError("NOT_FOUND", "VFS node was not found.", { nodeId }));
  }

  return ok(node);
}

const findChildByName = (state: VfsState, parentId: VfsNodeId, name: string): VfsResult<VfsNode> => {
  const parent = state.nodesById[parentId];

  if (!parent) {
    return fail(createVfsError("NOT_FOUND", "Parent node was not found.", { nodeId: parentId }));
  }

  if (parent.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "Path segment is not a directory.", { nodeId: parentId }));
  }

  const child = parent.childIds.map((childId) => state.nodesById[childId]).find((node) => node?.name === name);

  if (!child) {
    return fail(createVfsError("NOT_FOUND", "VFS path was not found."));
  }

  return ok(child);
};

export function resolveVfsPath(state: VfsState, path: string, cwd?: string): VfsResult<VfsNode> {
  const normalized = normalizeVfsPath(path, cwd);

  if (!normalized.ok) {
    return normalized;
  }

  if (normalized.value === "/") {
    return getVfsNodeById(state, state.rootId);
  }

  let currentId = state.rootId;

  for (const segment of splitVfsPath(normalized.value)) {
    const child = findChildByName(state, currentId, segment);

    if (!child.ok) {
      return fail({
        ...child.error,
        path: normalized.value,
      });
    }

    currentId = child.value.id;
  }

  return getVfsNodeById(state, currentId);
}

export function getVfsPathForNode(state: VfsState, nodeId: VfsNodeId): VfsResult<string> {
  const node = state.nodesById[nodeId];

  if (!node) {
    return fail(createVfsError("NOT_FOUND", "VFS node was not found.", { nodeId }));
  }

  if (node.id === state.rootId) {
    return ok("/");
  }

  const segments: string[] = [];
  const seen = new Set<VfsNodeId>();
  let current: VfsNode | undefined = node;

  while (current && current.parentId !== null) {
    if (seen.has(current.id)) {
      return fail(createVfsError("INVALID_PATH", "VFS parent cycle detected.", { nodeId: current.id }));
    }

    seen.add(current.id);
    segments.push(current.name);
    current = state.nodesById[current.parentId];
  }

  if (!current || current.id !== state.rootId) {
    return fail(createVfsError("NOT_FOUND", "VFS node is not reachable from root.", { nodeId }));
  }

  return ok(`/${segments.reverse().join("/")}`);
}

export function listVfsDirectory(
  state: VfsState,
  path: string,
  cwd?: string,
): VfsResult<readonly VfsNode[]> {
  const node = resolveVfsPath(state, path, cwd);

  if (!node.ok) {
    return node;
  }

  if (node.value.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "VFS node is not a directory.", { path, nodeId: node.value.id }));
  }

  return ok(node.value.childIds.map((childId) => state.nodesById[childId]).filter((child): child is VfsNode => Boolean(child)));
}

export function readVfsTextFile(
  state: VfsState,
  path: string,
  cwd?: string,
): VfsResult<VfsTextFileNode> {
  const node = resolveVfsPath(state, path, cwd);

  if (!node.ok) {
    return node;
  }

  if (node.value.kind !== "file") {
    return fail(createVfsError("IS_DIRECTORY", "VFS node is not a text file.", { path, nodeId: node.value.id }));
  }

  if (!isVfsTextFile(node.value)) {
    return fail(createVfsError("UNSUPPORTED_FILE_CONTENT", "VFS file is not backed by editable text.", { path, nodeId: node.value.id }));
  }

  return ok(node.value);
}

export function getVfsTrashEntry(state: VfsState, nodeId: VfsNodeId): VfsResult<VfsTrashEntry> {
  const entry = state.trashEntriesByNodeId[nodeId];

  if (!entry) {
    return fail(createVfsError("NOT_IN_TRASH", "VFS node is not a top-level Trash entry.", { nodeId }));
  }

  return ok(entry);
}

export function listVfsTrashEntries(
  state: VfsState,
): VfsResult<readonly { readonly entry: VfsTrashEntry; readonly node: VfsNode }[]> {
  const trash = state.nodesById[state.specialLocations.trash];

  if (!trash) {
    return fail(createVfsError("NOT_FOUND", "Trash special location was not found.", { nodeId: state.specialLocations.trash }));
  }

  if (trash.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "Trash special location is not a directory.", { nodeId: trash.id }));
  }

  const entries = [];

  for (const childId of trash.childIds) {
    const node = state.nodesById[childId];
    const entry = state.trashEntriesByNodeId[childId];

    if (!node) {
      return fail(createVfsError("NOT_FOUND", "Trash child was not found.", { nodeId: childId }));
    }

    if (!entry) {
      return fail(createVfsError("NOT_IN_TRASH", "Trash child is missing metadata.", { nodeId: childId }));
    }

    entries.push({ entry, node });
  }

  return ok(entries);
}
