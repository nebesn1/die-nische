import { type ReactNode } from "react";
import {
  createKonquerorBookmarkNodeId,
  type KonquerorBookmarkNodeId,
  type KonquerorBookmarkTree,
} from "./bookmarks";
import { KonquerorBookmarksContext } from "./konquerorBookmarksContext";
import {
  type KonquerorBookmarksStorage,
} from "./bookmarksPersistence";
import { useBookmarkStore } from "./useBookmarkStore";

type KonquerorBookmarksProviderProps = {
  readonly children: ReactNode;
  readonly initialBookmarks?: KonquerorBookmarkTree;
  readonly storage?: KonquerorBookmarksStorage;
  readonly createNodeId?: () => KonquerorBookmarkNodeId;
  readonly now?: () => string;
};

/** Desktop-owned bookmark authority shared by every Konqueror window and later bookmark surfaces. */
export function KonquerorBookmarksProvider({
  children,
  initialBookmarks,
  storage,
  createNodeId = createKonquerorBookmarkNodeId,
  now = () => new Date().toISOString(),
}: KonquerorBookmarksProviderProps) {
  const value = useBookmarkStore({ initialBookmarks, storage, createNodeId, now });

  return <KonquerorBookmarksContext.Provider value={value}>{children}</KonquerorBookmarksContext.Provider>;
}
