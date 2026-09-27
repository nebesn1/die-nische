import { createContext } from "react";
import {
  createInitialKonquerorBookmarkTree,
  type KonquerorBookmarkDraft,
  type KonquerorBookmarkFolderDraft,
  type KonquerorBookmarkFolderId,
  type KonquerorBookmarkNode,
  type KonquerorBookmarkNodeId,
  type KonquerorBookmarkNodeWithParent,
  type KonquerorBookmarkTree,
  type KonquerorBookmarkTreeMutationResult,
} from "./bookmarks";
import type { KonquerorBookmarksPersistenceStatus } from "./bookmarksPersistence";

export interface KonquerorBookmarksContextValue {
  readonly bookmarks: KonquerorBookmarkTree;
  readonly persistenceStatus: KonquerorBookmarksPersistenceStatus;
  getNode(nodeId: KonquerorBookmarkNodeId): KonquerorBookmarkNode | null;
  getNodeWithParent(nodeId: KonquerorBookmarkNodeId): KonquerorBookmarkNodeWithParent | null;
  getChildren(parentId?: KonquerorBookmarkFolderId | null): readonly KonquerorBookmarkNode[] | null;
  addBookmark(draft: KonquerorBookmarkDraft, parentId?: KonquerorBookmarkFolderId | null, index?: number): KonquerorBookmarkTreeMutationResult;
  addFolder(draft: KonquerorBookmarkFolderDraft, parentId?: KonquerorBookmarkFolderId | null, index?: number): KonquerorBookmarkTreeMutationResult;
  addFolderWithBookmarks(draft: KonquerorBookmarkFolderDraft, bookmarks: readonly KonquerorBookmarkDraft[], parentId?: KonquerorBookmarkFolderId | null, index?: number): KonquerorBookmarkTreeMutationResult;
  updateBookmark(nodeId: KonquerorBookmarkNodeId, update: Readonly<Partial<Pick<Extract<KonquerorBookmarkNode, { type: "bookmark" }>, "name" | "location" | "comment">>>): KonquerorBookmarkTreeMutationResult;
  updateFolder(nodeId: KonquerorBookmarkFolderId, update: Readonly<{ name: string }>): KonquerorBookmarkTreeMutationResult;
  deleteNode(nodeId: KonquerorBookmarkNodeId): KonquerorBookmarkTreeMutationResult;
  moveNode(nodeId: KonquerorBookmarkNodeId, destinationParentId: KonquerorBookmarkFolderId | null, index?: number): KonquerorBookmarkTreeMutationResult;
  reorderChild(parentId: KonquerorBookmarkFolderId | null, nodeId: KonquerorBookmarkNodeId, index: number): KonquerorBookmarkTreeMutationResult;
  recordVisit(nodeId: KonquerorBookmarkNodeId): KonquerorBookmarkTreeMutationResult;
}

const unavailable = (): KonquerorBookmarkTreeMutationResult => ({ ok: false, reason: "node-not-found" });

const defaultKonquerorBookmarksContextValue: KonquerorBookmarksContextValue = {
  bookmarks: createInitialKonquerorBookmarkTree(),
  persistenceStatus: { type: "storage-unavailable" },
  getNode: () => null,
  getNodeWithParent: () => null,
  getChildren: () => null,
  addBookmark: unavailable,
  addFolder: unavailable,
  addFolderWithBookmarks: unavailable,
  updateBookmark: unavailable,
  updateFolder: unavailable,
  deleteNode: unavailable,
  moveNode: unavailable,
  reorderChild: unavailable,
  recordVisit: unavailable,
};

export const KonquerorBookmarksContext = createContext<KonquerorBookmarksContextValue>(defaultKonquerorBookmarksContextValue);
