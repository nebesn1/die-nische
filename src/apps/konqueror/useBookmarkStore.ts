import { useCallback, useMemo, useState } from "react";
import {
  addKonquerorBookmark,
  addKonquerorBookmarkFolder,
  createInitialKonquerorBookmarkTree,
  createKonquerorBookmark,
  createKonquerorBookmarkFolder,
  createKonquerorBookmarkNodeId,
  deleteKonquerorBookmarkNode,
  findKonquerorBookmarkNodeWithParent,
  getKonquerorBookmarkChildren,
  getKonquerorBookmarkNode,
  moveKonquerorBookmarkNode,
  recordKonquerorBookmarkVisit,
  reorderKonquerorBookmarkChild,
  updateKonquerorBookmark,
  updateKonquerorBookmarkFolder,
  type KonquerorBookmarkDraft,
  type KonquerorBookmarkFolderDraft,
  type KonquerorBookmarkFolderId,
  type KonquerorBookmarkNodeId,
  type KonquerorBookmarkTree,
  type KonquerorBookmarkTreeMutationResult,
} from "./bookmarks";
import type { KonquerorBookmarksContextValue } from "./konquerorBookmarksContext";
import {
  createKonquerorBookmarksStorage,
  type KonquerorBookmarksPersistenceStatus,
  type KonquerorBookmarksStorage,
} from "./bookmarksPersistence";

type UseBookmarkStoreOptions = Readonly<{
  initialBookmarks?: KonquerorBookmarkTree;
  storage?: KonquerorBookmarksStorage;
  createNodeId?: () => KonquerorBookmarkNodeId;
  now?: () => string;
  storageKey?: string;
}>;

/** Reusable tree/store authority for application-specific bookmark contexts. */
export function useBookmarkStore({
  initialBookmarks,
  storage,
  createNodeId = createKonquerorBookmarkNodeId,
  now = () => new Date().toISOString(),
  storageKey,
}: UseBookmarkStoreOptions = {}): KonquerorBookmarksContextValue {
  const [persistence] = useState(() => storage ?? createKonquerorBookmarksStorage(undefined, storageKey));
  const [startup] = useState(() => initialBookmarks === undefined
    ? persistence.load()
    : { type: "provided" as const, bookmarks: initialBookmarks });
  const [bookmarks, setBookmarks] = useState<KonquerorBookmarkTree>(() => startup.bookmarks ?? createInitialKonquerorBookmarkTree());
  const [persistenceStatus, setPersistenceStatus] = useState<KonquerorBookmarksPersistenceStatus>(startup);

  const applyMutation = useCallback((result: KonquerorBookmarkTreeMutationResult): KonquerorBookmarkTreeMutationResult => {
    if (!result.ok) return result;
    const save = persistence.save(result.tree);
    setBookmarks(result.tree);
    setPersistenceStatus(save);
    return result;
  }, [persistence]);

  const addBookmark = useCallback((draft: KonquerorBookmarkDraft, parentId: KonquerorBookmarkFolderId | null = null, index?: number) =>
    applyMutation(addKonquerorBookmark(bookmarks, createKonquerorBookmark(draft, createNodeId()), parentId, index)), [applyMutation, bookmarks, createNodeId]);
  const addFolder = useCallback((draft: KonquerorBookmarkFolderDraft, parentId: KonquerorBookmarkFolderId | null = null, index?: number) =>
    applyMutation(addKonquerorBookmarkFolder(bookmarks, createKonquerorBookmarkFolder(draft, createNodeId()), parentId, index)), [applyMutation, bookmarks, createNodeId]);
  const addFolderWithBookmarks = useCallback((draft: KonquerorBookmarkFolderDraft, bookmarkDrafts: readonly KonquerorBookmarkDraft[], parentId: KonquerorBookmarkFolderId | null = null, index?: number) =>
    applyMutation(addKonquerorBookmarkFolder(bookmarks, createKonquerorBookmarkFolder(draft, createNodeId(), bookmarkDrafts.map((bookmarkDraft) => createKonquerorBookmark(bookmarkDraft, createNodeId()))), parentId, index)), [applyMutation, bookmarks, createNodeId]);
  const updateBookmark = useCallback((nodeId: KonquerorBookmarkNodeId, update: Readonly<Partial<{ name: string; location: string; comment: string }>>) =>
    applyMutation(updateKonquerorBookmark(bookmarks, nodeId, update)), [applyMutation, bookmarks]);
  const updateFolder = useCallback((nodeId: KonquerorBookmarkFolderId, update: Readonly<{ name: string }>) =>
    applyMutation(updateKonquerorBookmarkFolder(bookmarks, nodeId, update)), [applyMutation, bookmarks]);
  const deleteNode = useCallback((nodeId: KonquerorBookmarkNodeId) => applyMutation(deleteKonquerorBookmarkNode(bookmarks, nodeId)), [applyMutation, bookmarks]);
  const moveNode = useCallback((nodeId: KonquerorBookmarkNodeId, destinationParentId: KonquerorBookmarkFolderId | null, index?: number) =>
    applyMutation(moveKonquerorBookmarkNode(bookmarks, nodeId, destinationParentId, index)), [applyMutation, bookmarks]);
  const reorderChild = useCallback((parentId: KonquerorBookmarkFolderId | null, nodeId: KonquerorBookmarkNodeId, index: number) =>
    applyMutation(reorderKonquerorBookmarkChild(bookmarks, parentId, nodeId, index)), [applyMutation, bookmarks]);
  const recordVisit = useCallback((nodeId: KonquerorBookmarkNodeId) =>
    applyMutation(recordKonquerorBookmarkVisit(bookmarks, nodeId, now())), [applyMutation, bookmarks, now]);

  return useMemo(() => ({
    bookmarks,
    persistenceStatus,
    getNode: (nodeId: KonquerorBookmarkNodeId) => getKonquerorBookmarkNode(bookmarks, nodeId),
    getNodeWithParent: (nodeId: KonquerorBookmarkNodeId) => findKonquerorBookmarkNodeWithParent(bookmarks, nodeId),
    getChildren: (parentId: KonquerorBookmarkFolderId | null = null) => getKonquerorBookmarkChildren(bookmarks, parentId),
    addBookmark,
    addFolder,
    addFolderWithBookmarks,
    updateBookmark,
    updateFolder,
    deleteNode,
    moveNode,
    reorderChild,
    recordVisit,
  }), [addBookmark, addFolder, addFolderWithBookmarks, bookmarks, deleteNode, moveNode, persistenceStatus, recordVisit, reorderChild, updateBookmark, updateFolder]);
}
