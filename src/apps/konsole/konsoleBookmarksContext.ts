import { createContext } from "react";
import { createInitialKonquerorBookmarkTree, type KonquerorBookmarkTreeMutationResult } from "../konqueror/bookmarks";
import type { KonquerorBookmarksContextValue } from "../konqueror/konquerorBookmarksContext";

const unavailable = (): KonquerorBookmarkTreeMutationResult => ({ ok: false, reason: "node-not-found" });

const unavailableStore: KonquerorBookmarksContextValue = {
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

export const KonsoleBookmarksContext = createContext<KonquerorBookmarksContextValue>(unavailableStore);
