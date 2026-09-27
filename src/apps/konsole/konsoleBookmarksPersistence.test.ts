import { describe, expect, it } from "vitest";
import { createInitialKonquerorBookmarkTree } from "../konqueror/bookmarks";
import { KONQUEROR_BOOKMARKS_STORAGE_KEY } from "../konqueror/bookmarksPersistence";
import { KONSOLE_BOOKMARKS_STORAGE_KEY, createKonsoleBookmarksStorage } from "./konsoleBookmarksPersistence";

describe("Konsole bookmarks persistence", () => {
  it("uses a separate persistence key while retaining the shared safe schema adapter", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => { values.delete(key); },
    };
    const adapter = createKonsoleBookmarksStorage(() => storage);

    expect(adapter.save(createInitialKonquerorBookmarkTree())).toEqual({ type: "saved" });
    expect(values.has(KONSOLE_BOOKMARKS_STORAGE_KEY)).toBe(true);
    expect(values.has(KONQUEROR_BOOKMARKS_STORAGE_KEY)).toBe(false);
  });
});
