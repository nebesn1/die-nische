import { type ReactNode } from "react";
import {
  type KonquerorBookmarkNodeId,
  type KonquerorBookmarkTree,
} from "../konqueror/bookmarks";
import { useBookmarkStore } from "../konqueror/useBookmarkStore";
import { KONSOLE_BOOKMARKS_STORAGE_KEY, type KonsoleBookmarksStorage } from "./konsoleBookmarksPersistence";
import { KonsoleBookmarksContext } from "./konsoleBookmarksContext";

type KonsoleBookmarksProviderProps = Readonly<{
  children: ReactNode;
  initialBookmarks?: KonquerorBookmarkTree;
  storage?: KonsoleBookmarksStorage;
  createNodeId?: () => KonquerorBookmarkNodeId;
  now?: () => string;
}>;

/** Desktop-owned Konsole bookmark authority, deliberately separate from Konqueror bookmarks. */
export function KonsoleBookmarksProvider({ children, initialBookmarks, storage, createNodeId, now }: KonsoleBookmarksProviderProps) {
  const value = useBookmarkStore({
    initialBookmarks,
    storage,
    createNodeId,
    now,
    storageKey: KONSOLE_BOOKMARKS_STORAGE_KEY,
  });

  return <KonsoleBookmarksContext.Provider value={value}>{children}</KonsoleBookmarksContext.Provider>;
}
