import { createVfsError } from "./errors";
import { getVfsUtf8ByteSize } from "./encoding";
import { createVfsTextFileContent, isVfsTextFile } from "./fileContent";
import { validateVfsNodeName } from "./path";
import { getVfsPathForNode, resolveVfsPath } from "./queries";
import { mutationFail, mutationOk, type VfsMutationResult } from "./result";
import {
  createAvailableVfsName,
  getVfsDescendantIds,
  isProtectedVfsNode,
  isVfsNodeDescendantOf,
  isVfsNodeInsideTrash,
} from "./tree";
import type {
  CopyVfsNodeOptions,
  CreateVfsTextFileOptions,
  MoveVfsNodeOptions,
  VfsDirectoryNode,
  VfsFileNode,
  VfsDeleteResult,
  VfsBatchDeleteResult,
  VfsMutationOptions,
  VfsNode,
  VfsNodeId,
  VfsState,
  VfsLinkNode,
  VfsTextFileNode,
} from "./types";

export function formatVfsNodeId(sequence: number): VfsNodeId {
  return `vfs-node-${sequence.toString().padStart(4, "0")}`;
}

const getNextAvailableNodeId = (state: VfsState): VfsNodeId => {
  let sequence = state.nextNodeSequence;
  let id = formatVfsNodeId(sequence);

  while (state.nodesById[id]) {
    sequence += 1;
    id = formatVfsNodeId(sequence);
  }

  return id;
};

const getNextNodeSequenceAfter = (state: VfsState, id: VfsNodeId): number => {
  const numericSuffix = Number.parseInt(id.slice("vfs-node-".length), 10);

  return Number.isFinite(numericSuffix) ? Math.max(state.nextNodeSequence + 1, numericSuffix + 1) : state.nextNodeSequence + 1;
};

const getDirectoryByPath = (
  state: VfsState,
  path: string,
): VfsMutationResult<VfsDirectoryNode> => {
  const parent = resolveVfsPath(state, path);

  if (!parent.ok) {
    return mutationFail(state, parent.error);
  }

  if (parent.value.kind !== "directory") {
    return mutationFail(
      state,
      createVfsError("NOT_DIRECTORY", "Parent path is not a directory.", { path, nodeId: parent.value.id }),
    );
  }

  return mutationOk(state, parent.value);
};

const hasChildNamed = (state: VfsState, parent: VfsDirectoryNode, name: string): boolean => {
  return parent.childIds.some((childId) => state.nodesById[childId]?.name === name);
};

const getParentDirectory = (state: VfsState, node: VfsNode): VfsMutationResult<VfsDirectoryNode> => {
  const parent = node.parentId ? state.nodesById[node.parentId] : undefined;

  if (!parent || parent.kind !== "directory") {
    return mutationFail(
      state,
      createVfsError("NOT_DIRECTORY", "Parent node is not a directory.", { nodeId: node.parentId ?? undefined }),
    );
  }

  return mutationOk(state, parent);
};

const failProtectedNode = <T,>(state: VfsState, nodeId: VfsNodeId): VfsMutationResult<T> =>
  mutationFail(
    state,
    createVfsError("SPECIAL_LOCATION_OPERATION_FORBIDDEN", "Protected VFS locations cannot be moved or deleted.", {
      nodeId,
    }),
  );

const allocateVfsNodeIds = (
  state: VfsState,
  count: number,
): { readonly ids: readonly VfsNodeId[]; readonly nextNodeSequence: number } => {
  const ids: VfsNodeId[] = [];
  let sequence = state.nextNodeSequence;

  while (ids.length < count) {
    const id = formatVfsNodeId(sequence);

    if (!state.nodesById[id] && !ids.includes(id)) {
      ids.push(id);
    }

    sequence += 1;
  }

  return {
    ids,
    nextNodeSequence: sequence,
  };
};

const cloneSubtree = (
  state: VfsState,
  sourceNodeId: VfsNodeId,
  newParentId: VfsNodeId,
  rootName: string,
  idQueue: VfsNodeId[],
  now: string,
): { readonly root: VfsNode; readonly nodesById: Readonly<Record<VfsNodeId, VfsNode>> } => {
  const source = state.nodesById[sourceNodeId];
  const id = idQueue.shift();

  if (!source || !id) {
    throw new Error("cloneSubtree called with invalid precomputed ids.");
  }

  if (source.kind === "file") {
    const { publication, ...copySafeSource } = source;
    void publication;
    const file: VfsFileNode = {
      ...copySafeSource,
      id,
      name: rootName,
      parentId: newParentId,
      createdAt: now,
      modifiedAt: now,
    };

    return {
      root: file,
      nodesById: {
        [file.id]: file,
      },
    };
  }

  if (source.kind === "link") {
    const link: VfsLinkNode = {
      ...source,
      id,
      name: rootName,
      parentId: newParentId,
      createdAt: now,
      modifiedAt: now,
    };

    return {
      root: link,
      nodesById: {
        [link.id]: link,
      },
    };
  }

  const copiedChildIds: VfsNodeId[] = [];
  const copiedNodes: Record<VfsNodeId, VfsNode> = {};

  for (const childId of source.childIds) {
    const copiedChild = cloneSubtree(state, childId, id, state.nodesById[childId]?.name ?? "", idQueue, now);
    copiedChildIds.push(copiedChild.root.id);
    Object.assign(copiedNodes, copiedChild.nodesById);
  }

  const copiedDirectory: VfsDirectoryNode = {
    ...source,
    id,
    name: rootName,
    parentId: newParentId,
    childIds: copiedChildIds,
    createdAt: now,
    modifiedAt: now,
  };

  return {
    root: copiedDirectory,
    nodesById: {
      [copiedDirectory.id]: copiedDirectory,
      ...copiedNodes,
    },
  };
};

const collectSubtreeIdsIncludingRoot = (state: VfsState, nodeId: VfsNodeId): VfsMutationResult<readonly VfsNodeId[]> => {
  const descendants = getVfsDescendantIds(state, nodeId);

  if (!descendants.ok) {
    return mutationFail(state, descendants.error);
  }

  return mutationOk(state, [nodeId, ...descendants.value]);
};

export function createVfsDirectory(
  state: VfsState,
  parentPath: string,
  name: string,
  options: VfsMutationOptions,
): VfsMutationResult<VfsDirectoryNode> {
  const validName = validateVfsNodeName(name);

  if (!validName.ok) {
    return mutationFail(state, validName.error);
  }

  const parent = getDirectoryByPath(state, parentPath);

  if (!parent.ok) {
    return parent;
  }

  if (isVfsNodeInsideTrash(state, parent.value.id)) {
    return mutationFail(
      state,
      createVfsError("INVALID_DESTINATION", "Use move-to-trash to create top-level Trash entries.", {
        path: parentPath,
        nodeId: parent.value.id,
      }),
    );
  }

  if (hasChildNamed(state, parent.value, validName.value)) {
    return mutationFail(
      state,
      createVfsError("ALREADY_EXISTS", "A node with that name already exists.", { path: parentPath }),
    );
  }

  const id = getNextAvailableNodeId(state);
  const directory: VfsDirectoryNode = {
    id,
    name: validName.value,
    parentId: parent.value.id,
    kind: "directory",
    childIds: [],
    createdAt: options.now,
    modifiedAt: options.now,
  };
  const updatedParent: VfsDirectoryNode = {
    ...parent.value,
    childIds: [...parent.value.childIds, id],
    modifiedAt: options.now,
  };
  const nextState: VfsState = {
    ...state,
    nodesById: {
      ...state.nodesById,
      [parent.value.id]: updatedParent,
      [id]: directory,
    },
    nextNodeSequence: getNextNodeSequenceAfter(state, id),
    revision: state.revision + 1,
  };

  return mutationOk(nextState, directory);
}

export function createVfsTextFile(
  state: VfsState,
  parentPath: string,
  name: string,
  content: string,
  options: CreateVfsTextFileOptions,
): VfsMutationResult<VfsTextFileNode> {
  const validName = validateVfsNodeName(name);

  if (!validName.ok) {
    return mutationFail(state, validName.error);
  }

  const parent = getDirectoryByPath(state, parentPath);

  if (!parent.ok) {
    return parent;
  }

  if (isVfsNodeInsideTrash(state, parent.value.id)) {
    return mutationFail(
      state,
      createVfsError("INVALID_DESTINATION", "Use move-to-trash to create top-level Trash entries.", {
        path: parentPath,
        nodeId: parent.value.id,
      }),
    );
  }

  if (hasChildNamed(state, parent.value, validName.value)) {
    return mutationFail(
      state,
      createVfsError("ALREADY_EXISTS", "A node with that name already exists.", { path: parentPath }),
    );
  }

  const id = getNextAvailableNodeId(state);
  const file: VfsTextFileNode = {
    id,
    name: validName.value,
    parentId: parent.value.id,
    kind: "file",
    encoding: "utf-8",
    mimeType: options.mimeType ?? "text/plain",
    content: createVfsTextFileContent(content),
    size: getVfsUtf8ByteSize(content),
    createdAt: options.now,
    modifiedAt: options.now,
  };
  const updatedParent: VfsDirectoryNode = {
    ...parent.value,
    childIds: [...parent.value.childIds, id],
    modifiedAt: options.now,
  };
  const nextState: VfsState = {
    ...state,
    nodesById: {
      ...state.nodesById,
      [parent.value.id]: updatedParent,
      [id]: file,
    },
    nextNodeSequence: getNextNodeSequenceAfter(state, id),
    revision: state.revision + 1,
  };

  return mutationOk(nextState, file);
}

/** Creates identity links atomically. Source order becomes deterministic child insertion order. */
export function createVfsLinks(
  state: VfsState,
  destinationParentNodeId: VfsNodeId,
  sourceNodeIds: readonly VfsNodeId[],
  options: VfsMutationOptions,
): VfsMutationResult<readonly VfsLinkNode[]> {
  const destination = state.nodesById[destinationParentNodeId];

  if (!destination) {
    return mutationFail(state, createVfsError("NOT_FOUND", "The link destination no longer exists.", { nodeId: destinationParentNodeId }));
  }

  if (destination.kind !== "directory") {
    return mutationFail(state, createVfsError("NOT_DIRECTORY", "Links can only be created in a folder.", { nodeId: destination.id }));
  }

  if (isVfsNodeInsideTrash(state, destination.id)) {
    return mutationFail(state, createVfsError("INVALID_DESTINATION", "Links cannot be created in the Trash.", { nodeId: destination.id }));
  }

  const sources: VfsNode[] = [];
  const plannedNames = new Set<string>();
  for (const sourceNodeId of sourceNodeIds) {
    const source = state.nodesById[sourceNodeId];
    if (!source || source.parentId === null) {
      return mutationFail(state, createVfsError("NOT_FOUND", "A link source no longer exists.", { nodeId: sourceNodeId }));
    }
    if (isVfsNodeInsideTrash(state, source.id) || isProtectedVfsNode(state, source.id)) {
      return mutationFail(state, createVfsError("INVALID_DESTINATION", "A link source is unavailable.", { nodeId: source.id }));
    }
    if (hasChildNamed(state, destination, source.name) || plannedNames.has(source.name)) {
      return mutationFail(state, createVfsError("ALREADY_EXISTS", "A node with that name already exists in the destination.", { nodeId: destination.id }));
    }
    plannedNames.add(source.name);
    sources.push(source);
  }

  if (sources.length === 0) {
    return mutationOk(state, []);
  }

  const allocation = allocateVfsNodeIds(state, sources.length);
  const links = sources.map((source, index): VfsLinkNode => ({
    id: allocation.ids[index] ?? "",
    name: source.name,
    parentId: destination.id,
    kind: "link",
    targetNodeId: source.id,
    createdAt: options.now,
    modifiedAt: options.now,
  }));
  const updatedDestination: VfsDirectoryNode = {
    ...destination,
    childIds: [...destination.childIds, ...links.map((link) => link.id)],
    modifiedAt: options.now,
  };
  const nodesById: Record<VfsNodeId, VfsNode> = {
    ...state.nodesById,
    [updatedDestination.id]: updatedDestination,
  };
  links.forEach((link) => { nodesById[link.id] = link; });

  return mutationOk({
    ...state,
    nodesById,
    nextNodeSequence: allocation.nextNodeSequence,
    revision: state.revision + 1,
  }, links);
}

export function writeVfsTextFile(
  state: VfsState,
  path: string,
  content: string,
  options: VfsMutationOptions,
): VfsMutationResult<VfsTextFileNode> {
  const node = resolveVfsPath(state, path);

  if (!node.ok) {
    return mutationFail(state, node.error);
  }

  if (node.value.kind !== "file") {
    return mutationFail(
      state,
      createVfsError("IS_DIRECTORY", "Cannot write text content to a directory.", { path, nodeId: node.value.id }),
    );
  }

  if (!isVfsTextFile(node.value)) {
    return mutationFail(
      state,
      createVfsError("UNSUPPORTED_FILE_CONTENT", "Cannot write text content to an asset-backed file.", { path, nodeId: node.value.id }),
    );
  }

  if (node.value.content.text === content) {
    return mutationOk(state, node.value);
  }

  const file: VfsTextFileNode = {
    ...node.value,
    content: createVfsTextFileContent(content),
    size: getVfsUtf8ByteSize(content),
    modifiedAt: options.now,
  };
  const nextState: VfsState = {
    ...state,
    nodesById: {
      ...state.nodesById,
      [file.id]: file,
    },
    revision: state.revision + 1,
  };

  return mutationOk(nextState, file);
}

export function appendVfsTextFile(
  state: VfsState,
  path: string,
  text: string,
  options: VfsMutationOptions,
): VfsMutationResult<VfsTextFileNode> {
  const node = resolveVfsPath(state, path);

  if (!node.ok) {
    return mutationFail(state, node.error);
  }

  if (node.value.kind !== "file") {
    return mutationFail(
      state,
      createVfsError("IS_DIRECTORY", "Cannot append text content to a directory.", { path, nodeId: node.value.id }),
    );
  }

  if (!isVfsTextFile(node.value)) {
    return mutationFail(
      state,
      createVfsError("UNSUPPORTED_FILE_CONTENT", "Cannot append text content to an asset-backed file.", { path, nodeId: node.value.id }),
    );
  }

  if (text.length === 0) {
    return mutationOk(state, node.value);
  }

  const content = `${node.value.content.text}${text}`;
  const file: VfsTextFileNode = {
    ...node.value,
    content: createVfsTextFileContent(content),
    size: getVfsUtf8ByteSize(content),
    modifiedAt: options.now,
  };
  const nextState: VfsState = {
    ...state,
    nodesById: {
      ...state.nodesById,
      [file.id]: file,
    },
    revision: state.revision + 1,
  };

  return mutationOk(nextState, file);
}

export function renameVfsNode(
  state: VfsState,
  path: string,
  newName: string,
  options: VfsMutationOptions,
): VfsMutationResult<VfsNode> {
  const node = resolveVfsPath(state, path);

  if (!node.ok) {
    return mutationFail(state, node.error);
  }

  if (node.value.id === state.rootId) {
    return mutationFail(
      state,
      createVfsError("ROOT_OPERATION_FORBIDDEN", "The root directory cannot be renamed.", { path }),
    );
  }

  const validName = validateVfsNodeName(newName);

  if (!validName.ok) {
    return mutationFail(state, validName.error);
  }

  const parent = node.value.parentId ? state.nodesById[node.value.parentId] : undefined;

  if (!parent || parent.kind !== "directory") {
    return mutationFail(
      state,
      createVfsError("NOT_DIRECTORY", "Parent node is not a directory.", { nodeId: node.value.parentId ?? undefined }),
    );
  }

  const existingSibling = parent.childIds
    .map((childId) => state.nodesById[childId])
    .find((child) => child && child.id !== node.value.id && child.name === validName.value);

  if (existingSibling) {
    const parentPath = getVfsPathForNode(state, parent.id);
    return mutationFail(
      state,
      createVfsError("ALREADY_EXISTS", "A sibling with that name already exists.", {
        path: parentPath.ok ? parentPath.value : path,
      }),
    );
  }

  if (node.value.name === validName.value) {
    return mutationOk(state, node.value);
  }

  const renamedNode: VfsNode = {
    ...node.value,
    name: validName.value,
    modifiedAt: options.now,
  };
  const updatedParent: VfsDirectoryNode = {
    ...parent,
    modifiedAt: options.now,
  };
  const nextState: VfsState = {
    ...state,
    nodesById: {
      ...state.nodesById,
      [parent.id]: updatedParent,
      [renamedNode.id]: renamedNode,
    },
    revision: state.revision + 1,
  };

  return mutationOk(nextState, renamedNode);
}

export function moveVfsNode(
  state: VfsState,
  sourcePath: string,
  destinationDirectoryPath: string,
  options: MoveVfsNodeOptions,
): VfsMutationResult<VfsNode> {
  const source = resolveVfsPath(state, sourcePath);

  if (!source.ok) {
    return mutationFail(state, source.error);
  }

  const destination = getDirectoryByPath(state, destinationDirectoryPath);

  if (!destination.ok) {
    return destination;
  }

  if (source.value.id === state.rootId) {
    return mutationFail(state, createVfsError("ROOT_OPERATION_FORBIDDEN", "The root directory cannot be moved.", { path: sourcePath }));
  }

  if (isProtectedVfsNode(state, source.value.id)) {
    return failProtectedNode(state, source.value.id);
  }

  if (isVfsNodeInsideTrash(state, source.value.id)) {
    return mutationFail(state, createVfsError("ALREADY_IN_TRASH", "Trash entries cannot be moved with regular move.", { nodeId: source.value.id }));
  }

  if (isVfsNodeInsideTrash(state, destination.value.id)) {
    return mutationFail(
      state,
      createVfsError("INVALID_DESTINATION", "Use move-to-trash to place nodes in Trash.", {
        path: destinationDirectoryPath,
        nodeId: destination.value.id,
      }),
    );
  }

  if (destination.value.id === source.value.id || isVfsNodeDescendantOf(state, destination.value.id, source.value.id)) {
    return mutationFail(
      state,
      createVfsError("INVALID_DESTINATION", "A directory cannot be moved into itself or its descendant.", {
        path: destinationDirectoryPath,
        nodeId: destination.value.id,
      }),
    );
  }

  const sourceParent = getParentDirectory(state, source.value);

  if (!sourceParent.ok) {
    return sourceParent;
  }

  const finalName = options.newName ?? source.value.name;
  const validName = validateVfsNodeName(finalName);

  if (!validName.ok) {
    return mutationFail(state, validName.error);
  }

  if (sourceParent.value.id === destination.value.id) {
    return renameVfsNode(state, sourcePath, validName.value, options);
  }

  if (hasChildNamed(state, destination.value, validName.value)) {
    return mutationFail(
      state,
      createVfsError("ALREADY_EXISTS", "A node with that name already exists in the destination.", {
        path: destinationDirectoryPath,
      }),
    );
  }

  const updatedSourceParent: VfsDirectoryNode = {
    ...sourceParent.value,
    childIds: sourceParent.value.childIds.filter((childId) => childId !== source.value.id),
    modifiedAt: options.now,
  };
  const updatedDestination: VfsDirectoryNode = {
    ...destination.value,
    childIds: [...destination.value.childIds, source.value.id],
    modifiedAt: options.now,
  };
  const movedNode: VfsNode = {
    ...source.value,
    name: validName.value,
    parentId: destination.value.id,
    modifiedAt: options.now,
  };

  return mutationOk(
    {
      ...state,
      nodesById: {
        ...state.nodesById,
        [updatedSourceParent.id]: updatedSourceParent,
        [updatedDestination.id]: updatedDestination,
        [movedNode.id]: movedNode,
      },
      revision: state.revision + 1,
    },
    movedNode,
  );
}

export function copyVfsNode(
  state: VfsState,
  sourcePath: string,
  destinationDirectoryPath: string,
  options: CopyVfsNodeOptions,
): VfsMutationResult<VfsNode> {
  const source = resolveVfsPath(state, sourcePath);

  if (!source.ok) {
    return mutationFail(state, source.error);
  }

  const destination = getDirectoryByPath(state, destinationDirectoryPath);

  if (!destination.ok) {
    return destination;
  }

  if (source.value.id === state.rootId || source.value.id === state.specialLocations.trash) {
    return mutationFail(
      state,
      createVfsError("ROOT_OPERATION_FORBIDDEN", "Root and Trash root cannot be copied.", {
        path: sourcePath,
        nodeId: source.value.id,
      }),
    );
  }

  if (isVfsNodeInsideTrash(state, destination.value.id)) {
    return mutationFail(
      state,
      createVfsError("INVALID_DESTINATION", "Regular copy cannot create Trash entries.", {
        path: destinationDirectoryPath,
        nodeId: destination.value.id,
      }),
    );
  }

  if (destination.value.id === source.value.id || isVfsNodeDescendantOf(state, destination.value.id, source.value.id)) {
    return mutationFail(
      state,
      createVfsError("INVALID_DESTINATION", "A directory cannot be copied into itself or its descendant.", {
        path: destinationDirectoryPath,
        nodeId: destination.value.id,
      }),
    );
  }

  const finalName = options.newName ?? source.value.name;
  const validName = validateVfsNodeName(finalName);

  if (!validName.ok) {
    return mutationFail(state, validName.error);
  }

  if (hasChildNamed(state, destination.value, validName.value)) {
    return mutationFail(
      state,
      createVfsError("ALREADY_EXISTS", "A node with that name already exists in the destination.", {
        path: destinationDirectoryPath,
      }),
    );
  }

  const descendants = getVfsDescendantIds(state, source.value.id);

  if (!descendants.ok) {
    return mutationFail(state, descendants.error);
  }

  const { ids, nextNodeSequence } = allocateVfsNodeIds(state, descendants.value.length + 1);
  const copied = cloneSubtree(state, source.value.id, destination.value.id, validName.value, [...ids], options.now);
  const updatedDestination: VfsDirectoryNode = {
    ...destination.value,
    childIds: [...destination.value.childIds, copied.root.id],
    modifiedAt: options.now,
  };

  return mutationOk(
    {
      ...state,
      nodesById: {
        ...state.nodesById,
        ...copied.nodesById,
        [updatedDestination.id]: updatedDestination,
      },
      nextNodeSequence,
      revision: state.revision + 1,
    },
    copied.root,
  );
}

export function moveVfsNodeToTrash(
  state: VfsState,
  sourcePath: string,
  options: VfsMutationOptions,
): VfsMutationResult<VfsNode> {
  const source = resolveVfsPath(state, sourcePath);

  if (!source.ok) {
    return mutationFail(state, source.error);
  }

  if (source.value.id === state.rootId) {
    return mutationFail(state, createVfsError("ROOT_OPERATION_FORBIDDEN", "The root directory cannot be moved to Trash.", { path: sourcePath }));
  }

  if (isProtectedVfsNode(state, source.value.id)) {
    return failProtectedNode(state, source.value.id);
  }

  if (isVfsNodeInsideTrash(state, source.value.id)) {
    return mutationFail(state, createVfsError("ALREADY_IN_TRASH", "Node is already in Trash.", { nodeId: source.value.id }));
  }

  const sourceParent = getParentDirectory(state, source.value);

  if (!sourceParent.ok) {
    return sourceParent;
  }

  const trash = state.nodesById[state.specialLocations.trash];

  if (!trash || trash.kind !== "directory") {
    return mutationFail(state, createVfsError("NOT_DIRECTORY", "Trash special location is not a directory.", { nodeId: state.specialLocations.trash }));
  }

  const trashName = createAvailableVfsName(state, trash.id, source.value.name);
  const trashedNode: VfsNode = {
    ...source.value,
    name: trashName,
    parentId: trash.id,
    modifiedAt: options.now,
  };
  const updatedSourceParent: VfsDirectoryNode = {
    ...sourceParent.value,
    childIds: sourceParent.value.childIds.filter((childId) => childId !== source.value.id),
    modifiedAt: options.now,
  };
  const updatedTrash: VfsDirectoryNode = {
    ...trash,
    childIds: [...trash.childIds, source.value.id],
    modifiedAt: options.now,
  };

  return mutationOk(
    {
      ...state,
      nodesById: {
        ...state.nodesById,
        [updatedSourceParent.id]: updatedSourceParent,
        [updatedTrash.id]: updatedTrash,
        [trashedNode.id]: trashedNode,
      },
      trashEntriesByNodeId: {
        ...state.trashEntriesByNodeId,
        [source.value.id]: {
          nodeId: source.value.id,
          originalParentId: sourceParent.value.id,
          originalName: source.value.name,
          trashedAt: options.now,
        },
      },
      revision: state.revision + 1,
    },
    trashedNode,
  );
}

export function restoreVfsNodeFromTrash(
  state: VfsState,
  nodeId: VfsNodeId,
  options: VfsMutationOptions,
): VfsMutationResult<VfsNode> {
  const entry = state.trashEntriesByNodeId[nodeId];

  if (!entry) {
    return mutationFail(state, createVfsError("NOT_IN_TRASH", "Node is not a top-level Trash entry.", { nodeId }));
  }

  const node = state.nodesById[nodeId];
  const trash = state.nodesById[state.specialLocations.trash];

  if (!node || !trash || trash.kind !== "directory" || node.parentId !== trash.id || !trash.childIds.includes(nodeId)) {
    return mutationFail(state, createVfsError("NOT_IN_TRASH", "Trash entry node is not in Trash.", { nodeId }));
  }

  const originalParent = state.nodesById[entry.originalParentId];

  if (!originalParent || originalParent.kind !== "directory" || isVfsNodeInsideTrash(state, originalParent.id)) {
    return mutationFail(
      state,
      createVfsError("RESTORE_TARGET_UNAVAILABLE", "Original restore directory is unavailable.", {
        nodeId: entry.originalParentId,
      }),
    );
  }

  if (hasChildNamed(state, originalParent, entry.originalName)) {
    const parentPath = getVfsPathForNode(state, originalParent.id);
    return mutationFail(
      state,
      createVfsError("ALREADY_EXISTS", "A node with the original name already exists.", {
        path: parentPath.ok ? parentPath.value : undefined,
        nodeId,
      }),
    );
  }

  const restoredNode: VfsNode = {
    ...node,
    name: entry.originalName,
    parentId: originalParent.id,
    modifiedAt: options.now,
  };
  const updatedTrash: VfsDirectoryNode = {
    ...trash,
    childIds: trash.childIds.filter((childId) => childId !== nodeId),
    modifiedAt: options.now,
  };
  const updatedOriginalParent: VfsDirectoryNode = {
    ...originalParent,
    childIds: [...originalParent.childIds, nodeId],
    modifiedAt: options.now,
  };
  const trashEntriesByNodeId = { ...state.trashEntriesByNodeId };
  delete trashEntriesByNodeId[nodeId];

  return mutationOk(
    {
      ...state,
      nodesById: {
        ...state.nodesById,
        [updatedTrash.id]: updatedTrash,
        [updatedOriginalParent.id]: updatedOriginalParent,
        [restoredNode.id]: restoredNode,
      },
      trashEntriesByNodeId,
      revision: state.revision + 1,
    },
    restoredNode,
  );
}

export function deleteVfsNodePermanently(
  state: VfsState,
  nodeId: VfsNodeId,
  options: VfsMutationOptions,
): VfsMutationResult<VfsDeleteResult> {
  if (nodeId === state.specialLocations.trash) {
    return mutationFail(state, createVfsError("SPECIAL_LOCATION_OPERATION_FORBIDDEN", "Trash root cannot be deleted.", { nodeId }));
  }

  if (!state.trashEntriesByNodeId[nodeId]) {
    return mutationFail(state, createVfsError("NOT_IN_TRASH", "Only top-level Trash entries can be permanently deleted.", { nodeId }));
  }

  const node = state.nodesById[nodeId];
  const trash = state.nodesById[state.specialLocations.trash];

  if (!node || !trash || trash.kind !== "directory" || node.parentId !== trash.id || !trash.childIds.includes(nodeId)) {
    return mutationFail(state, createVfsError("NOT_IN_TRASH", "Trash entry node is not in Trash.", { nodeId }));
  }

  const subtree = collectSubtreeIdsIncludingRoot(state, nodeId);

  if (!subtree.ok) {
    return subtree;
  }

  const deletedNodeIds = subtree.value;
  const deletedSet = new Set(deletedNodeIds);
  const nodesById: Record<VfsNodeId, VfsNode> = { ...state.nodesById };
  const trashEntriesByNodeId = { ...state.trashEntriesByNodeId };

  deletedNodeIds.forEach((deletedNodeId) => {
    delete nodesById[deletedNodeId];
    delete trashEntriesByNodeId[deletedNodeId];
  });

  const updatedTrash: VfsDirectoryNode = {
    ...trash,
    childIds: trash.childIds.filter((childId) => !deletedSet.has(childId)),
    modifiedAt: options.now,
  };

  nodesById[updatedTrash.id] = updatedTrash;

  return mutationOk(
    {
      ...state,
      nodesById,
      trashEntriesByNodeId,
      revision: state.revision + 1,
    },
    { deletedNodeIds },
  );
}

export function emptyVfsTrash(
  state: VfsState,
  options: VfsMutationOptions,
): VfsMutationResult<VfsDeleteResult> {
  const trash = state.nodesById[state.specialLocations.trash];

  if (!trash || trash.kind !== "directory") {
    return mutationFail(state, createVfsError("NOT_DIRECTORY", "Trash special location is not a directory.", { nodeId: state.specialLocations.trash }));
  }

  if (trash.childIds.length === 0) {
    return mutationOk(state, { deletedNodeIds: [] });
  }

  const deletedNodeIds: VfsNodeId[] = [];

  for (const childId of trash.childIds) {
    const subtree = collectSubtreeIdsIncludingRoot(state, childId);

    if (!subtree.ok) {
      return mutationFail(state, subtree.error);
    }

    deletedNodeIds.push(...subtree.value);
  }

  const deletedSet = new Set(deletedNodeIds);
  const nodesById: Record<VfsNodeId, VfsNode> = { ...state.nodesById };
  const trashEntriesByNodeId = { ...state.trashEntriesByNodeId };

  deletedNodeIds.forEach((deletedNodeId) => {
    delete nodesById[deletedNodeId];
    delete trashEntriesByNodeId[deletedNodeId];
  });

  const updatedTrash: VfsDirectoryNode = {
    ...trash,
    childIds: trash.childIds.filter((childId) => !deletedSet.has(childId)),
    modifiedAt: options.now,
  };

  nodesById[updatedTrash.id] = updatedTrash;

  return mutationOk(
    {
      ...state,
      nodesById,
      trashEntriesByNodeId: {},
      revision: state.revision + 1,
    },
    { deletedNodeIds },
  );
}

/**
 * Batch mutations run against an unpublished candidate state. A later failure
 * returns the original state, so callers can publish one all-or-nothing VFS
 * transition.
 */
const applyVfsBatch = <T,>(
  state: VfsState,
  inputs: readonly T[],
  apply: (candidate: VfsState, input: T) => VfsMutationResult<VfsNode>,
): VfsMutationResult<readonly VfsNode[]> => {
  let candidate = state;
  const results: VfsNode[] = [];

  for (const input of inputs) {
    const result = apply(candidate, input);
    if (!result.ok) {
      return mutationFail(state, result.error);
    }
    candidate = result.state;
    results.push(result.value);
  }

  return mutationOk(candidate, results);
};

export function copyVfsNodes(
  state: VfsState,
  sourcePaths: readonly string[],
  destinationDirectoryPath: string,
  options: CopyVfsNodeOptions,
): VfsMutationResult<readonly VfsNode[]> {
  return applyVfsBatch(state, sourcePaths, (candidate, sourcePath) =>
    copyVfsNode(candidate, sourcePath, destinationDirectoryPath, options),
  );
}

export function moveVfsNodes(
  state: VfsState,
  sourcePaths: readonly string[],
  destinationDirectoryPath: string,
  options: MoveVfsNodeOptions,
): VfsMutationResult<readonly VfsNode[]> {
  return applyVfsBatch(state, sourcePaths, (candidate, sourcePath) =>
    moveVfsNode(candidate, sourcePath, destinationDirectoryPath, options),
  );
}

export function moveVfsNodesToTrash(
  state: VfsState,
  sourcePaths: readonly string[],
  options: VfsMutationOptions,
): VfsMutationResult<readonly VfsNode[]> {
  return applyVfsBatch(state, sourcePaths, (candidate, sourcePath) => moveVfsNodeToTrash(candidate, sourcePath, options));
}

export function restoreVfsNodesFromTrash(
  state: VfsState,
  nodeIds: readonly VfsNodeId[],
  options: VfsMutationOptions,
): VfsMutationResult<readonly VfsNode[]> {
  return applyVfsBatch(state, nodeIds, (candidate, nodeId) => restoreVfsNodeFromTrash(candidate, nodeId, options));
}

export function deleteVfsNodesPermanently(
  state: VfsState,
  nodeIds: readonly VfsNodeId[],
  options: VfsMutationOptions,
): VfsMutationResult<VfsBatchDeleteResult> {
  let candidate = state;
  const deletedNodeIds: VfsNodeId[] = [];

  for (const nodeId of nodeIds) {
    const result = deleteVfsNodePermanently(candidate, nodeId, options);
    if (!result.ok) {
      return mutationFail(state, result.error);
    }
    candidate = result.state;
    deletedNodeIds.push(...result.value.deletedNodeIds);
  }

  return mutationOk(candidate, { deletedNodeIds, deletedRootNodeIds: [...nodeIds] });
}
