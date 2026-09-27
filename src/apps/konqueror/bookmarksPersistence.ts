import {
  createInitialKonquerorBookmarkTree,
  type KonquerorBookmark,
  type KonquerorBookmarkFolder,
  type KonquerorBookmarkNode,
  type KonquerorBookmarkTree,
} from "./bookmarks";

export const KONQUEROR_BOOKMARKS_STORAGE_KEY = "kde3-web-desktop.konqueror.bookmarks.v1";
export const KONQUEROR_BOOKMARKS_SCHEMA_VERSION = 1;

export type PersistedKonquerorBookmarksV1 = Readonly<{
  version: typeof KONQUEROR_BOOKMARKS_SCHEMA_VERSION;
  rootChildren: readonly KonquerorBookmarkNode[];
}>;

type KonquerorBookmarksInvalidReason =
  | "malformed-json"
  | "invalid-root"
  | "invalid-version"
  | "missing-root-children"
  | "invalid-tree";

export type ParsedKonquerorBookmarks =
  | Readonly<{ type: "valid"; bookmarks: KonquerorBookmarkTree }>
  | Readonly<{ type: "invalid"; reason: KonquerorBookmarksInvalidReason }>
  | Readonly<{ type: "unsupported-version"; version: number }>;

export type KonquerorBookmarksLoadResult =
  | Readonly<{ type: "loaded"; bookmarks: KonquerorBookmarkTree }>
  | Readonly<{ type: "missing"; bookmarks: KonquerorBookmarkTree }>
  | Readonly<{ type: "invalid"; bookmarks: KonquerorBookmarkTree; reason: KonquerorBookmarksInvalidReason; corruptRecordRemoved: boolean }>
  | Readonly<{ type: "unsupported-version"; bookmarks: KonquerorBookmarkTree; version: number }>
  | Readonly<{ type: "storage-unavailable"; bookmarks: KonquerorBookmarkTree }>
  | Readonly<{ type: "read-failed"; bookmarks: KonquerorBookmarkTree }>;

export type KonquerorBookmarksSaveResult =
  | Readonly<{ type: "saved" }>
  | Readonly<{ type: "storage-unavailable" }>
  | Readonly<{ type: "write-failed" }>;

export type KonquerorBookmarksPersistenceStatus = KonquerorBookmarksLoadResult | KonquerorBookmarksSaveResult | Readonly<{ type: "provided" }>;

export interface KonquerorBookmarksStorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface KonquerorBookmarksStorage {
  load(): KonquerorBookmarksLoadResult;
  save(bookmarks: KonquerorBookmarkTree): KonquerorBookmarksSaveResult;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNodeId = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const parseBookmarkNode = (value: unknown, seenIds: Set<string>): KonquerorBookmarkNode | null => {
  if (!isRecord(value) || !isNodeId(value.id) || seenIds.has(value.id) || typeof value.type !== "string" || typeof value.name !== "string") {
    return null;
  }

  seenIds.add(value.id);

  if (value.type === "bookmark") {
    if (typeof value.location !== "string"
      || typeof value.comment !== "string"
      || (value.firstViewed !== null && typeof value.firstViewed !== "string")
      || (value.lastViewed !== null && typeof value.lastViewed !== "string")
      || typeof value.visitCount !== "number"
      || !Number.isSafeInteger(value.visitCount)
      || value.visitCount < 0) {
      return null;
    }

    return {
      id: value.id,
      type: "bookmark",
      name: value.name,
      location: value.location,
      comment: value.comment,
      firstViewed: value.firstViewed,
      lastViewed: value.lastViewed,
      visitCount: value.visitCount,
    } satisfies KonquerorBookmark;
  }

  if (value.type !== "folder" || !Array.isArray(value.children)) {
    return null;
  }

  const children: KonquerorBookmarkNode[] = [];
  for (const child of value.children) {
    const node = parseBookmarkNode(child, seenIds);
    if (node === null) {
      return null;
    }
    children.push(node);
  }

  return { id: value.id, type: "folder", name: value.name, children } satisfies KonquerorBookmarkFolder;
};

const parseTree = (value: unknown): KonquerorBookmarkTree | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const seenIds = new Set<string>();
  const rootChildren: KonquerorBookmarkNode[] = [];
  for (const child of value) {
    const node = parseBookmarkNode(child, seenIds);
    if (node === null) {
      return null;
    }
    rootChildren.push(node);
  }

  return { rootChildren };
};

export function serializeKonquerorBookmarks(bookmarks: KonquerorBookmarkTree): string {
  const record: PersistedKonquerorBookmarksV1 = {
    version: KONQUEROR_BOOKMARKS_SCHEMA_VERSION,
    rootChildren: bookmarks.rootChildren,
  };

  return JSON.stringify(record);
}

export function parsePersistedKonquerorBookmarks(raw: string): ParsedKonquerorBookmarks {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { type: "invalid", reason: "malformed-json" };
  }

  if (!isRecord(value)) {
    return { type: "invalid", reason: "invalid-root" };
  }
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
    return { type: "invalid", reason: "invalid-version" };
  }
  if (value.version !== KONQUEROR_BOOKMARKS_SCHEMA_VERSION) {
    return { type: "unsupported-version", version: value.version };
  }
  if (!("rootChildren" in value)) {
    return { type: "invalid", reason: "missing-root-children" };
  }

  const bookmarks = parseTree(value.rootChildren);
  return bookmarks === null ? { type: "invalid", reason: "invalid-tree" } : { type: "valid", bookmarks };
}

const getBrowserLocalStorage = (): KonquerorBookmarksStorageBackend | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function createKonquerorBookmarksStorage(
  getStorage: () => KonquerorBookmarksStorageBackend | null = getBrowserLocalStorage,
  storageKey = KONQUEROR_BOOKMARKS_STORAGE_KEY,
): KonquerorBookmarksStorage {
  const getAvailableStorage = (): KonquerorBookmarksStorageBackend | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };

  return {
    load() {
      const storage = getAvailableStorage();
      const defaults = createInitialKonquerorBookmarkTree();
      if (storage === null) {
        return { type: "storage-unavailable", bookmarks: defaults };
      }

      let raw: string | null;
      try {
        raw = storage.getItem(storageKey);
      } catch {
        return { type: "read-failed", bookmarks: defaults };
      }
      if (raw === null) {
        return { type: "missing", bookmarks: defaults };
      }

      const parsed = parsePersistedKonquerorBookmarks(raw);
      if (parsed.type === "valid") {
        return { type: "loaded", bookmarks: parsed.bookmarks };
      }
      if (parsed.type === "unsupported-version") {
        return { type: "unsupported-version", bookmarks: defaults, version: parsed.version };
      }

      let corruptRecordRemoved = false;
      try {
        storage.removeItem(storageKey);
        corruptRecordRemoved = true;
      } catch {
        // Corrupt browser data must not prevent the desktop from starting.
      }
      return { type: "invalid", bookmarks: defaults, reason: parsed.reason, corruptRecordRemoved };
    },

    save(bookmarks) {
      const storage = getAvailableStorage();
      if (storage === null) {
        return { type: "storage-unavailable" };
      }

      try {
        storage.setItem(storageKey, serializeKonquerorBookmarks(bookmarks));
        return { type: "saved" };
      } catch {
        return { type: "write-failed" };
      }
    },
  };
}
