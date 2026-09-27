export type KonquerorBookmarkNodeId = string;
export type KonquerorBookmarkFolderId = KonquerorBookmarkNodeId;

export type KonquerorBookmark = Readonly<{
  id: KonquerorBookmarkNodeId;
  type: "bookmark";
  name: string;
  location: string;
  comment: string;
  firstViewed: string | null;
  lastViewed: string | null;
  visitCount: number;
}>;

export type KonquerorBookmarkFolder = Readonly<{
  id: KonquerorBookmarkFolderId;
  type: "folder";
  name: string;
  children: readonly KonquerorBookmarkNode[];
}>;

export type KonquerorBookmarkNode = KonquerorBookmark | KonquerorBookmarkFolder;

export type KonquerorBookmarkTree = Readonly<{
  rootChildren: readonly KonquerorBookmarkNode[];
}>;

export type KonquerorBookmarkDraft = Readonly<{
  name: string;
  location: string;
  comment?: string;
}>;

export type KonquerorBookmarkFolderDraft = Readonly<{
  name: string;
}>;

export type KonquerorBookmarkTreeMutationFailure =
  | "duplicate-id"
  | "node-not-found"
  | "parent-not-found"
  | "parent-is-not-folder"
  | "cycle";

export type KonquerorBookmarkTreeMutationResult =
  | Readonly<{ ok: true; tree: KonquerorBookmarkTree }>
  | Readonly<{ ok: false; reason: KonquerorBookmarkTreeMutationFailure }>;

export type KonquerorBookmarkNodeWithParent = Readonly<{
  node: KonquerorBookmarkNode;
  parentId: KonquerorBookmarkFolderId | null;
}>;

export const createInitialKonquerorBookmarkTree = (): KonquerorBookmarkTree => ({ rootChildren: [] });

export const isKonquerorBookmarkFolder = (node: KonquerorBookmarkNode): node is KonquerorBookmarkFolder => node.type === "folder";

export function createKonquerorBookmarkNodeId(): KonquerorBookmarkNodeId {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `bookmark-${randomUuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

export const createKonquerorBookmark = (
  draft: KonquerorBookmarkDraft,
  id: KonquerorBookmarkNodeId = createKonquerorBookmarkNodeId(),
): KonquerorBookmark => ({
  id,
  type: "bookmark",
  name: draft.name,
  location: draft.location,
  comment: draft.comment ?? "",
  firstViewed: null,
  lastViewed: null,
  visitCount: 0,
});

export const createKonquerorBookmarkFolder = (
  draft: KonquerorBookmarkFolderDraft,
  id: KonquerorBookmarkFolderId = createKonquerorBookmarkNodeId(),
  children: readonly KonquerorBookmarkNode[] = [],
): KonquerorBookmarkFolder => ({
  id,
  type: "folder",
  name: draft.name,
  children,
});

const ok = (tree: KonquerorBookmarkTree): KonquerorBookmarkTreeMutationResult => ({ ok: true, tree });
const fail = (reason: KonquerorBookmarkTreeMutationFailure): KonquerorBookmarkTreeMutationResult => ({ ok: false, reason });

const clampInsertionIndex = (index: number | undefined, length: number): number => {
  if (index === undefined || !Number.isFinite(index)) {
    return length;
  }

  return Math.min(Math.max(0, Math.trunc(index)), length);
};

const findInNodes = (
  nodes: readonly KonquerorBookmarkNode[],
  nodeId: KonquerorBookmarkNodeId,
  parentId: KonquerorBookmarkFolderId | null,
): KonquerorBookmarkNodeWithParent | null => {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return { node, parentId };
    }

    if (isKonquerorBookmarkFolder(node)) {
      const found = findInNodes(node.children, nodeId, node.id);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;
};

export const findKonquerorBookmarkNodeWithParent = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkNodeId,
): KonquerorBookmarkNodeWithParent | null => findInNodes(tree.rootChildren, nodeId, null);

export const getKonquerorBookmarkNode = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkNodeId,
): KonquerorBookmarkNode | null => findKonquerorBookmarkNodeWithParent(tree, nodeId)?.node ?? null;

export const getKonquerorBookmarkChildren = (
  tree: KonquerorBookmarkTree,
  parentId: KonquerorBookmarkFolderId | null = null,
): readonly KonquerorBookmarkNode[] | null => {
  if (parentId === null) {
    return tree.rootChildren;
  }

  const parent = getKonquerorBookmarkNode(tree, parentId);
  return parent !== null && isKonquerorBookmarkFolder(parent) ? parent.children : null;
};

const replaceFolderChildren = (
  nodes: readonly KonquerorBookmarkNode[],
  folderId: KonquerorBookmarkFolderId,
  update: (children: readonly KonquerorBookmarkNode[]) => readonly KonquerorBookmarkNode[],
): readonly KonquerorBookmarkNode[] | null => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (!isKonquerorBookmarkFolder(node)) {
      continue;
    }

    if (node.id === folderId) {
      return nodes.map((candidate, candidateIndex) => candidateIndex === index
        ? { ...node, children: update(node.children) }
        : candidate,
      );
    }

    const nested = replaceFolderChildren(node.children, folderId, update);
    if (nested !== null) {
      return nodes.map((candidate, candidateIndex) => candidateIndex === index
        ? { ...node, children: nested }
        : candidate,
      );
    }
  }

  return null;
};

const updateChildren = (
  tree: KonquerorBookmarkTree,
  parentId: KonquerorBookmarkFolderId | null,
  update: (children: readonly KonquerorBookmarkNode[]) => readonly KonquerorBookmarkNode[],
): KonquerorBookmarkTree | null => {
  if (parentId === null) {
    return { rootChildren: update(tree.rootChildren) };
  }

  const rootChildren = replaceFolderChildren(tree.rootChildren, parentId, update);
  return rootChildren === null ? null : { rootChildren };
};

const getKonquerorBookmarkSubtreeIds = (node: KonquerorBookmarkNode): readonly KonquerorBookmarkNodeId[] => [
  node.id,
  ...(isKonquerorBookmarkFolder(node) ? node.children.flatMap(getKonquerorBookmarkSubtreeIds) : []),
];

const insertNode = (
  tree: KonquerorBookmarkTree,
  node: KonquerorBookmarkNode,
  parentId: KonquerorBookmarkFolderId | null,
  index?: number,
): KonquerorBookmarkTreeMutationResult => {
  const subtreeIds = getKonquerorBookmarkSubtreeIds(node);
  if (
    new Set(subtreeIds).size !== subtreeIds.length ||
    subtreeIds.some((nodeId) => getKonquerorBookmarkNode(tree, nodeId) !== null)
  ) {
    return fail("duplicate-id");
  }

  if (parentId !== null) {
    const parent = getKonquerorBookmarkNode(tree, parentId);
    if (parent === null) {
      return fail("parent-not-found");
    }
    if (!isKonquerorBookmarkFolder(parent)) {
      return fail("parent-is-not-folder");
    }
  }

  const next = updateChildren(tree, parentId, (children) => {
    const at = clampInsertionIndex(index, children.length);
    return [...children.slice(0, at), node, ...children.slice(at)];
  });
  return next === null ? fail("parent-not-found") : ok(next);
};

export const addKonquerorBookmark = (
  tree: KonquerorBookmarkTree,
  bookmark: KonquerorBookmark,
  parentId: KonquerorBookmarkFolderId | null = null,
  index?: number,
): KonquerorBookmarkTreeMutationResult => insertNode(tree, bookmark, parentId, index);

export const addKonquerorBookmarkFolder = (
  tree: KonquerorBookmarkTree,
  folder: KonquerorBookmarkFolder,
  parentId: KonquerorBookmarkFolderId | null = null,
  index?: number,
): KonquerorBookmarkTreeMutationResult => insertNode(tree, folder, parentId, index);

const replaceNode = (
  nodes: readonly KonquerorBookmarkNode[],
  nodeId: KonquerorBookmarkNodeId,
  update: (node: KonquerorBookmarkNode) => KonquerorBookmarkNode | null,
): readonly KonquerorBookmarkNode[] | null => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.id === nodeId) {
      const nextNode = update(node);
      return nextNode === null ? null : nodes.map((candidate, candidateIndex) => candidateIndex === index ? nextNode : candidate);
    }

    if (isKonquerorBookmarkFolder(node)) {
      const nested = replaceNode(node.children, nodeId, update);
      if (nested !== null) {
        return nodes.map((candidate, candidateIndex) => candidateIndex === index
          ? { ...node, children: nested }
          : candidate,
        );
      }
    }
  }

  return null;
};

export const updateKonquerorBookmark = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkNodeId,
  update: Readonly<Partial<Pick<KonquerorBookmark, "name" | "location" | "comment">>>,
): KonquerorBookmarkTreeMutationResult => {
  const rootChildren = replaceNode(tree.rootChildren, nodeId, (node) => node.type === "bookmark" ? { ...node, ...update } : null);
  return rootChildren === null ? fail("node-not-found") : ok({ rootChildren });
};

export const updateKonquerorBookmarkFolder = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkFolderId,
  update: Readonly<Pick<KonquerorBookmarkFolder, "name">>,
): KonquerorBookmarkTreeMutationResult => {
  const rootChildren = replaceNode(tree.rootChildren, nodeId, (node) => node.type === "folder" ? { ...node, ...update } : null);
  return rootChildren === null ? fail("node-not-found") : ok({ rootChildren });
};

export const recordKonquerorBookmarkVisit = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkNodeId,
  viewedAt: string = new Date().toISOString(),
): KonquerorBookmarkTreeMutationResult => {
  const rootChildren = replaceNode(tree.rootChildren, nodeId, (node) => node.type === "bookmark"
    ? {
      ...node,
      firstViewed: node.firstViewed ?? viewedAt,
      lastViewed: viewedAt,
      visitCount: node.visitCount + 1,
    }
    : null);
  return rootChildren === null ? fail("node-not-found") : ok({ rootChildren });
};

export const deleteKonquerorBookmarkNode = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkNodeId,
): KonquerorBookmarkTreeMutationResult => {
  const located = findKonquerorBookmarkNodeWithParent(tree, nodeId);
  if (located === null) {
    return fail("node-not-found");
  }

  const next = updateChildren(tree, located.parentId, (children) => children.filter((node) => node.id !== nodeId));
  return next === null ? fail("parent-not-found") : ok(next);
};

const folderContainsNode = (folder: KonquerorBookmarkFolder, nodeId: KonquerorBookmarkNodeId): boolean =>
  folder.children.some((node) => node.id === nodeId || (isKonquerorBookmarkFolder(node) && folderContainsNode(node, nodeId)));

export const moveKonquerorBookmarkNode = (
  tree: KonquerorBookmarkTree,
  nodeId: KonquerorBookmarkNodeId,
  destinationParentId: KonquerorBookmarkFolderId | null,
  index?: number,
): KonquerorBookmarkTreeMutationResult => {
  const source = findKonquerorBookmarkNodeWithParent(tree, nodeId);
  if (source === null) {
    return fail("node-not-found");
  }

  if (destinationParentId !== null) {
    const destination = getKonquerorBookmarkNode(tree, destinationParentId);
    if (destination === null) {
      return fail("parent-not-found");
    }
    if (!isKonquerorBookmarkFolder(destination)) {
      return fail("parent-is-not-folder");
    }
    if (source.node.type === "folder" && (destination.id === source.node.id || folderContainsNode(source.node, destination.id))) {
      return fail("cycle");
    }
  }

  const removed = deleteKonquerorBookmarkNode(tree, nodeId);
  if (!removed.ok) {
    return removed;
  }

  return insertNode(removed.tree, source.node, destinationParentId, index);
};

export const reorderKonquerorBookmarkChild = (
  tree: KonquerorBookmarkTree,
  parentId: KonquerorBookmarkFolderId | null,
  nodeId: KonquerorBookmarkNodeId,
  index: number,
): KonquerorBookmarkTreeMutationResult => {
  const children = getKonquerorBookmarkChildren(tree, parentId);
  if (children === null) {
    return parentId === null ? fail("parent-not-found") : getKonquerorBookmarkNode(tree, parentId) === null
      ? fail("parent-not-found")
      : fail("parent-is-not-folder");
  }

  const currentIndex = children.findIndex((node) => node.id === nodeId);
  if (currentIndex < 0) {
    return fail("node-not-found");
  }

  const node = children[currentIndex]!;
  const remaining = children.filter((candidate) => candidate.id !== nodeId);
  const at = clampInsertionIndex(index, remaining.length);
  const next = updateChildren(tree, parentId, () => [...remaining.slice(0, at), node, ...remaining.slice(at)]);
  return next === null ? fail("parent-not-found") : ok(next);
};
