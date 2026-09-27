import { describe, expect, it } from "vitest";
import type { KonquerorBookmarkNode } from "../konqueror/bookmarks";
import { getKonsoleBookmarksMenuEntries } from "./konsoleBookmarksMenuModel";

const bookmark = (id: string, name: string): KonquerorBookmarkNode => ({
  id,
  type: "bookmark",
  name,
  location: `/${id}/`,
  comment: "",
  firstViewed: null,
  lastViewed: null,
  visitCount: 0,
});
const folder = (id: string, name: string, children: readonly KonquerorBookmarkNode[] = []): KonquerorBookmarkNode => ({ id, type: "folder", name, children });
const labels = (entries: ReturnType<typeof getKonsoleBookmarksMenuEntries>) => entries.map((entry) => entry.type === "separator" ? "separator" : entry.label);

describe("Konsole bookmarks menu model", () => {
  it("keeps the required root commands and has no dangling separator for an empty tree", () => {
    expect(labels(getKonsoleBookmarksMenuEntries([]))).toEqual(["Add Bookmark", "Edit Bookmarks", "New Bookmark Folder..."]);
  });

  it("preserves root mixed Bookmark and Folder ordering with stable bookmark action identities", () => {
    const entries = getKonsoleBookmarksMenuEntries([
      bookmark("a", "Bookmark A"), folder("b", "Folder B"), bookmark("c", "Bookmark C"), folder("d", "Folder D"), bookmark("e", "Bookmark E"),
    ]);

    expect(labels(entries)).toEqual(["Add Bookmark", "Edit Bookmarks", "New Bookmark Folder...", "separator", "Bookmark A", "Folder B", "Bookmark C", "Folder D", "Bookmark E"]);
    expect(entries[4]).toMatchObject({ type: "action", id: "bookmark:a", action: { type: "open-bookmark", bookmarkId: "a" } });
    expect(entries[5]).toMatchObject({ type: "submenu", id: "folder:b" });
  });

  it("preserves nested mixed ordering before the folder-specific commands", () => {
    const entries = getKonsoleBookmarksMenuEntries([
      folder("work", "Work", [bookmark("x", "Bookmark X"), folder("y", "Folder Y"), bookmark("z", "Bookmark Z")]),
    ]);
    const work = entries[4];
    if (work?.type !== "submenu") throw new Error("Missing Work submenu");

    expect(work.children.map((entry) => entry.type === "separator" ? "separator" : entry.label)).toEqual([
      "Bookmark X", "Folder Y", "Bookmark Z", "separator", "Add Bookmark", "New Bookmark Folder...",
    ]);
  });
});
