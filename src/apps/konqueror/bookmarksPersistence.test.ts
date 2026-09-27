import { describe, expect, it } from "vitest";
import {
  addKonquerorBookmark,
  addKonquerorBookmarkFolder,
  createInitialKonquerorBookmarkTree,
  createKonquerorBookmark,
  createKonquerorBookmarkFolder,
  recordKonquerorBookmarkVisit,
} from "./bookmarks";
import {
  KONQUEROR_BOOKMARKS_STORAGE_KEY,
  createKonquerorBookmarksStorage,
  parsePersistedKonquerorBookmarks,
  serializeKonquerorBookmarks,
  type KonquerorBookmarksStorageBackend,
} from "./bookmarksPersistence";

const expectOk = <T extends { readonly ok: boolean }>(result: T): Extract<T, { readonly ok: true }> => {
  if (!result.ok) throw new Error("Expected mutation to succeed");
  return result as Extract<T, { readonly ok: true }>;
};

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): KonquerorBookmarksStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("Konqueror bookmarks persistence", () => {
  it("round-trips ordered hierarchy and visit metadata through a versioned record", () => {
    const withFolder = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), createKonquerorBookmarkFolder({ name: "Work" }, "folder-work"))).tree;
    const withBookmark = expectOk(addKonquerorBookmark(withFolder, createKonquerorBookmark({ name: "Example", location: "https://example.com", comment: "reference" }, "bookmark-example"), "folder-work")).tree;
    const bookmarks = expectOk(recordKonquerorBookmarkVisit(withBookmark, "bookmark-example", "2026-09-07T00:00:00.000Z")).tree;
    const storage = createMemoryStorage();
    const adapter = createKonquerorBookmarksStorage(() => storage);

    expect(adapter.save(bookmarks)).toEqual({ type: "saved" });
    expect(adapter.load()).toEqual({ type: "loaded", bookmarks });
    expect(parsePersistedKonquerorBookmarks(serializeKonquerorBookmarks(bookmarks))).toEqual({ type: "valid", bookmarks });
  });

  it("creates an empty tree for missing data and safely removes malformed persisted records", () => {
    const storage = createMemoryStorage();
    const adapter = createKonquerorBookmarksStorage(() => storage);

    expect(adapter.load()).toEqual({ type: "missing", bookmarks: createInitialKonquerorBookmarkTree() });
    storage.values.set(KONQUEROR_BOOKMARKS_STORAGE_KEY, "{bad");
    expect(adapter.load()).toMatchObject({ type: "invalid", bookmarks: createInitialKonquerorBookmarkTree(), reason: "malformed-json" });
    expect(storage.values.has(KONQUEROR_BOOKMARKS_STORAGE_KEY)).toBe(false);
  });

  it("rejects duplicate IDs, malformed node metadata, and unsupported schemas", () => {
    expect(parsePersistedKonquerorBookmarks(JSON.stringify({
      version: 1,
      rootChildren: [
        { id: "duplicate", type: "bookmark", name: "A", location: "/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
        { id: "duplicate", type: "folder", name: "B", children: [] },
      ],
    }))).toEqual({ type: "invalid", reason: "invalid-tree" });
    expect(parsePersistedKonquerorBookmarks(JSON.stringify({ version: 1, rootChildren: [
      { id: "bad", type: "bookmark", name: "Bad", location: "/", comment: "", firstViewed: null, lastViewed: null, visitCount: -1 },
    ] }))).toEqual({ type: "invalid", reason: "invalid-tree" });
    expect(parsePersistedKonquerorBookmarks(JSON.stringify({ version: 2, rootChildren: [] }))).toEqual({ type: "unsupported-version", version: 2 });
  });

  it("recovers safely from missing bookmark fields and malformed recursive folder children", () => {
    const storage = createMemoryStorage();
    const adapter = createKonquerorBookmarksStorage(() => storage);

    storage.values.set(KONQUEROR_BOOKMARKS_STORAGE_KEY, JSON.stringify({
      version: 1,
      rootChildren: [{ type: "bookmark", name: "Missing id", location: "/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 }],
    }));
    const missingId = adapter.load();
    expect(missingId).toMatchObject({ type: "invalid", bookmarks: createInitialKonquerorBookmarkTree(), reason: "invalid-tree" });

    storage.values.set(KONQUEROR_BOOKMARKS_STORAGE_KEY, JSON.stringify({
      version: 1,
      rootChildren: [{ id: "missing-location", type: "bookmark", name: "Missing location", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 }],
    }));
    expect(adapter.load()).toMatchObject({ type: "invalid", bookmarks: createInitialKonquerorBookmarkTree(), reason: "invalid-tree" });

    storage.values.set(KONQUEROR_BOOKMARKS_STORAGE_KEY, JSON.stringify({
      version: 1,
      rootChildren: [{ id: "folder", type: "folder", name: "Folder", children: "not-an-array" }],
    }));
    expect(adapter.load()).toMatchObject({ type: "invalid", bookmarks: createInitialKonquerorBookmarkTree(), reason: "invalid-tree" });

    storage.values.set(KONQUEROR_BOOKMARKS_STORAGE_KEY, JSON.stringify({
      version: 1,
      rootChildren: [{ id: "folder", type: "folder", name: "Folder", children: [{ id: "child", type: "bookmark", name: "Child" }] }],
    }));
    expect(adapter.load()).toMatchObject({ type: "invalid", bookmarks: createInitialKonquerorBookmarkTree(), reason: "invalid-tree" });
  });

  it("contains storage access, read, write, and corrupt-record cleanup failures", () => {
    expect(createKonquerorBookmarksStorage(() => null).load()).toEqual({ type: "storage-unavailable", bookmarks: createInitialKonquerorBookmarkTree() });
    expect(createKonquerorBookmarksStorage(() => { throw new Error("blocked"); }).load()).toEqual({ type: "storage-unavailable", bookmarks: createInitialKonquerorBookmarkTree() });

    const readFailure: KonquerorBookmarksStorageBackend = {
      getItem: () => { throw new Error("read failed"); },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(createKonquerorBookmarksStorage(() => readFailure).load()).toEqual({ type: "read-failed", bookmarks: createInitialKonquerorBookmarkTree() });

    const writeFailure: KonquerorBookmarksStorageBackend = {
      getItem: () => null,
      setItem: () => { throw new Error("write failed"); },
      removeItem: () => {},
    };
    expect(createKonquerorBookmarksStorage(() => writeFailure).save(createInitialKonquerorBookmarkTree())).toEqual({ type: "write-failed" });

    const cleanupFailure: KonquerorBookmarksStorageBackend = {
      getItem: () => "{bad",
      setItem: () => {},
      removeItem: () => { throw new Error("cleanup failed"); },
    };
    expect(() => createKonquerorBookmarksStorage(() => cleanupFailure).load()).not.toThrow();
    expect(createKonquerorBookmarksStorage(() => cleanupFailure).load()).toMatchObject({
      type: "invalid",
      bookmarks: createInitialKonquerorBookmarkTree(),
      reason: "malformed-json",
      corruptRecordRemoved: false,
    });
  });
});
