import {
  createKonquerorBookmarksStorage,
  type KonquerorBookmarksStorage,
  type KonquerorBookmarksStorageBackend,
} from "../konqueror/bookmarksPersistence";

export const KONSOLE_BOOKMARKS_STORAGE_KEY = "kde3-web-desktop.konsole.bookmarks.v1";

export type KonsoleBookmarksStorage = KonquerorBookmarksStorage;

/** Uses the shared, versioned bookmark schema with a Konsole-specific persistence namespace. */
export function createKonsoleBookmarksStorage(
  getStorage?: () => KonquerorBookmarksStorageBackend | null,
): KonsoleBookmarksStorage {
  return createKonquerorBookmarksStorage(getStorage, KONSOLE_BOOKMARKS_STORAGE_KEY);
}
