import { createVfsError } from "./errors";
import { restoreVfsNodesFromTrash } from "./mutations";
import { mutationFail, mutationOk, ok, type VfsMutationResult, type VfsResult } from "./result";
import { getVfsDescendantIds, isProtectedVfsNode, isVfsNodeDescendantOf, isVfsNodeInsideTrash } from "./tree";
import type { VfsDirectoryNode, VfsMutationOptions, VfsNode, VfsNodeId, VfsState } from "./types";

export type VfsFileOperationUndoKind = "create" | "copy" | "link" | "rename" | "move" | "trash";

export type VfsUndoCreatedRoot = {
  readonly nodeId: VfsNodeId;
  readonly parentId: VfsNodeId;
  readonly name: string;
  /** Semantic subtree identity, intentionally excluding mutable timestamps. */
  readonly fingerprint: string;
};

export type VfsUndoRelocationRoot = {
  readonly nodeId: VfsNodeId;
  readonly beforeParentId: VfsNodeId;
  readonly beforeName: string;
  readonly afterParentId: VfsNodeId;
  readonly afterName: string;
};

export type VfsUndoTrashRoot = {
  readonly nodeId: VfsNodeId;
  readonly originalParentId: VfsNodeId;
  readonly originalName: string;
  readonly trashName: string;
  readonly trashedAt: string;
};

export type VfsFileOperationUndoEntry =
  | { readonly kind: "create" | "copy" | "link"; readonly roots: readonly VfsUndoCreatedRoot[] }
  | { readonly kind: "rename"; readonly root: VfsUndoRelocationRoot }
  | { readonly kind: "move"; readonly roots: readonly VfsUndoRelocationRoot[] }
  | { readonly kind: "trash"; readonly roots: readonly VfsUndoTrashRoot[] };

const getDirectory = (state: VfsState, nodeId: VfsNodeId): VfsResult<VfsDirectoryNode> => {
  const node = state.nodesById[nodeId];
  if (!node) return { ok: false, error: createVfsError("NOT_FOUND", "VFS directory was not found.", { nodeId }) };
  if (node.kind !== "directory") return { ok: false, error: createVfsError("NOT_DIRECTORY", "VFS node is not a directory.", { nodeId }) };
  return ok(node);
};

const findSibling = (state: VfsState, parent: VfsDirectoryNode, name: string, exceptId?: VfsNodeId): VfsNode | undefined =>
  parent.childIds
    .map((childId) => state.nodesById[childId])
    .find((node) => node !== undefined && node.id !== exceptId && node.name === name);

const fingerprintNode = (state: VfsState, nodeId: VfsNodeId): VfsResult<string> => {
  const node = state.nodesById[nodeId];
  if (!node) return { ok: false, error: createVfsError("NOT_FOUND", "VFS node was not found.", { nodeId }) };

  if (node.kind === "file") {
    return ok(JSON.stringify({ id: node.id, kind: node.kind, parentId: node.parentId, name: node.name, encoding: node.encoding, mimeType: node.mimeType, content: node.content, size: node.size }));
  }
  if (node.kind === "link") {
    return ok(JSON.stringify({ id: node.id, kind: node.kind, parentId: node.parentId, name: node.name, targetNodeId: node.targetNodeId }));
  }

  const children: string[] = [];
  for (const childId of node.childIds) {
    const child = fingerprintNode(state, childId);
    if (!child.ok) return child;
    children.push(child.value);
  }
  return ok(JSON.stringify({ id: node.id, kind: node.kind, parentId: node.parentId, name: node.name, children }));
};

const getBeforeNode = (beforeState: VfsState, nodeId: VfsNodeId): VfsResult<VfsNode> => {
  const node = beforeState.nodesById[nodeId];
  return node ? ok(node) : { ok: false, error: createVfsError("NOT_FOUND", "VFS operation source was not found.", { nodeId }) };
};

/** Builds an operation descriptor only after a mutation has committed its post-state. */
export function createVfsFileOperationUndoEntry(
  kind: VfsFileOperationUndoKind,
  beforeState: VfsState,
  afterState: VfsState,
  nodeIds: readonly VfsNodeId[],
): VfsResult<VfsFileOperationUndoEntry | null> {
  if (nodeIds.length === 0) return ok(null);

  if (kind === "create" || kind === "copy" || kind === "link") {
    const roots: VfsUndoCreatedRoot[] = [];
    for (const nodeId of nodeIds) {
      const node = afterState.nodesById[nodeId];
      if (!node || node.parentId === null) return { ok: false, error: createVfsError("NOT_FOUND", "Created VFS node was not found.", { nodeId }) };
      const fingerprint = fingerprintNode(afterState, nodeId);
      if (!fingerprint.ok) return fingerprint;
      roots.push({ nodeId, parentId: node.parentId, name: node.name, fingerprint: fingerprint.value });
    }
    return ok({ kind, roots });
  }

  if (kind === "trash") {
    const roots: VfsUndoTrashRoot[] = [];
    for (const nodeId of nodeIds) {
      const node = afterState.nodesById[nodeId];
      const entry = afterState.trashEntriesByNodeId[nodeId];
      if (!node || !entry || node.parentId !== afterState.specialLocations.trash) {
        return { ok: false, error: createVfsError("NOT_IN_TRASH", "Trashed VFS node is no longer available.", { nodeId }) };
      }
      roots.push({ nodeId, originalParentId: entry.originalParentId, originalName: entry.originalName, trashName: node.name, trashedAt: entry.trashedAt });
    }
    return ok({ kind, roots });
  }

  const roots: VfsUndoRelocationRoot[] = [];
  for (const nodeId of nodeIds) {
    const before = getBeforeNode(beforeState, nodeId);
    const after = afterState.nodesById[nodeId];
    if (!before.ok || !after || before.value.parentId === null || after.parentId === null) {
      return before.ok
        ? { ok: false, error: createVfsError("NOT_FOUND", "VFS operation result was not found.", { nodeId }) }
        : before;
    }
    if (before.value.parentId === after.parentId && before.value.name === after.name) continue;
    roots.push({
      nodeId,
      beforeParentId: before.value.parentId,
      beforeName: before.value.name,
      afterParentId: after.parentId,
      afterName: after.name,
    });
  }
  if (roots.length === 0) return ok(null);
  return kind === "rename" ? ok({ kind, root: roots[0]! }) : ok({ kind, roots });
}

const failUndo = <T,>(state: VfsState, message: string, nodeId?: VfsNodeId): VfsMutationResult<T> =>
  mutationFail(state, createVfsError("INVALID_DESTINATION", message, { nodeId }));

const ensureCreatedRootsAreUnchanged = (state: VfsState, roots: readonly VfsUndoCreatedRoot[]): VfsMutationResult<void> => {
  const rootIds = new Set(roots.map((root) => root.nodeId));
  if (rootIds.size !== roots.length) return failUndo(state, "Undo entry contains duplicate created nodes.");

  for (const root of roots) {
    const node = state.nodesById[root.nodeId];
    if (!node || node.parentId !== root.parentId || node.name !== root.name) {
      return failUndo(state, "Created item changed location or was replaced; undo cannot safely remove it.", root.nodeId);
    }
    const parent = getDirectory(state, root.parentId);
    if (!parent.ok || !parent.value.childIds.includes(root.nodeId) || isProtectedVfsNode(state, root.nodeId) || isVfsNodeInsideTrash(state, root.nodeId)) {
      return failUndo(state, "Created item is not safe to remove.", root.nodeId);
    }
    const fingerprint = fingerprintNode(state, root.nodeId);
    if (!fingerprint.ok || fingerprint.value !== root.fingerprint) {
      return failUndo(state, "Created item was modified; undo cannot safely remove it.", root.nodeId);
    }
    for (const otherId of rootIds) {
      if (otherId !== root.nodeId && isVfsNodeDescendantOf(state, root.nodeId, otherId)) {
        return failUndo(state, "Undo entry contains nested created roots.", root.nodeId);
      }
    }
  }
  return mutationOk(state, undefined);
};

const undoCreatedRoots = (state: VfsState, roots: readonly VfsUndoCreatedRoot[], options: VfsMutationOptions): VfsMutationResult<void> => {
  const checked = ensureCreatedRootsAreUnchanged(state, roots);
  if (!checked.ok) return checked;

  const deletedIds = new Set<VfsNodeId>();
  for (const root of roots) {
    const subtree = getVfsDescendantIds(state, root.nodeId);
    if (!subtree.ok) return mutationFail(state, subtree.error);
    deletedIds.add(root.nodeId);
    subtree.value.forEach((id) => deletedIds.add(id));
  }
  const nodesById: Record<VfsNodeId, VfsNode> = { ...state.nodesById };
  const affectedParents = new Set(roots.map((root) => root.parentId));
  for (const id of deletedIds) delete nodesById[id];
  for (const parentId of affectedParents) {
    const parent = state.nodesById[parentId];
    if (!parent || parent.kind !== "directory") return failUndo(state, "Created item parent is unavailable.", parentId);
    nodesById[parentId] = { ...parent, childIds: parent.childIds.filter((id) => !deletedIds.has(id)), modifiedAt: options.now };
  }
  return mutationOk({ ...state, nodesById, revision: state.revision + 1 }, undefined);
};

const undoRelocations = (state: VfsState, roots: readonly VfsUndoRelocationRoot[], options: VfsMutationOptions): VfsMutationResult<void> => {
  if (roots.length === 0) return mutationOk(state, undefined);
  const rootIds = new Set(roots.map((root) => root.nodeId));
  if (rootIds.size !== roots.length) return failUndo(state, "Undo entry contains duplicate moved nodes.");

  for (const root of roots) {
    const node = state.nodesById[root.nodeId];
    const destination = getDirectory(state, root.beforeParentId);
    if (!node || node.parentId !== root.afterParentId || node.name !== root.afterName || !destination.ok) {
      return failUndo(state, "Moved item changed location or its original folder is unavailable.", root.nodeId);
    }
    if (isProtectedVfsNode(state, node.id) || isVfsNodeInsideTrash(state, node.id) || node.id === destination.value.id || isVfsNodeDescendantOf(state, destination.value.id, node.id)) {
      return failUndo(state, "Moved item cannot safely be restored to its original folder.", root.nodeId);
    }
    const collision = findSibling(state, destination.value, root.beforeName, node.id);
    if (collision && !rootIds.has(collision.id)) return failUndo(state, "Original item name is now occupied; undo cannot replace it.", root.nodeId);
  }

  const nodesById: Record<VfsNodeId, VfsNode> = { ...state.nodesById };
  const parentUpdates = new Map<VfsNodeId, VfsDirectoryNode>();
  const parent = (id: VfsNodeId): VfsDirectoryNode | null => {
    const current = parentUpdates.get(id) ?? state.nodesById[id];
    if (!current || current.kind !== "directory") return null;
    return current;
  };
  for (const root of roots) {
    const currentParent = parent(root.afterParentId);
    const originalParent = parent(root.beforeParentId);
    if (!currentParent || !originalParent) return failUndo(state, "Moved item parent is unavailable.", root.nodeId);
    parentUpdates.set(currentParent.id, { ...currentParent, childIds: currentParent.childIds.filter((id) => id !== root.nodeId), modifiedAt: options.now });
  }
  for (const root of roots) {
    const originalParent = parent(root.beforeParentId);
    if (!originalParent) return failUndo(state, "Original parent is unavailable.", root.nodeId);
    parentUpdates.set(originalParent.id, { ...originalParent, childIds: [...originalParent.childIds, root.nodeId], modifiedAt: options.now });
    const node = state.nodesById[root.nodeId]!;
    nodesById[root.nodeId] = { ...node, parentId: root.beforeParentId, name: root.beforeName, modifiedAt: options.now };
  }
  parentUpdates.forEach((value, id) => { nodesById[id] = value; });
  return mutationOk({ ...state, nodesById, revision: state.revision + 1 }, undefined);
};

const undoRename = (state: VfsState, root: VfsUndoRelocationRoot, options: VfsMutationOptions): VfsMutationResult<void> =>
  undoRelocations(state, [root], options);

const undoTrash = (state: VfsState, roots: readonly VfsUndoTrashRoot[], options: VfsMutationOptions): VfsMutationResult<void> => {
  if (roots.length === 0) return mutationOk(state, undefined);
  const trashId = state.specialLocations.trash;
  for (const root of roots) {
    const node = state.nodesById[root.nodeId];
    const entry = state.trashEntriesByNodeId[root.nodeId];
    if (!node || node.parentId !== trashId || node.name !== root.trashName || !entry || entry.originalParentId !== root.originalParentId || entry.originalName !== root.originalName || entry.trashedAt !== root.trashedAt) {
      return failUndo(state, "Trash entry changed or was replaced; undo cannot safely restore it.", root.nodeId);
    }
  }
  const restored = restoreVfsNodesFromTrash(state, roots.map((root) => root.nodeId), options);
  return restored.ok ? mutationOk(restored.state, undefined) : mutationFail(state, restored.error);
};

/** Executes one inverse transition against a stable-ID descriptor. No caller-visible partial state is published. */
export function undoVfsFileOperation(
  state: VfsState,
  entry: VfsFileOperationUndoEntry,
  options: VfsMutationOptions,
): VfsMutationResult<void> {
  if (entry.kind === "create" || entry.kind === "copy" || entry.kind === "link") return undoCreatedRoots(state, entry.roots, options);
  if (entry.kind === "rename") return undoRename(state, entry.root, options);
  if (entry.kind === "move") return undoRelocations(state, entry.roots, options);
  if (entry.kind === "trash") return undoTrash(state, entry.roots, options);
  return failUndo(state, "Unknown file operation undo entry.");
}
