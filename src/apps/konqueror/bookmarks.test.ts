import { describe, expect, it } from "vitest";
import {
  addKonquerorBookmark,
  addKonquerorBookmarkFolder,
  createInitialKonquerorBookmarkTree,
  createKonquerorBookmark,
  createKonquerorBookmarkFolder,
  deleteKonquerorBookmarkNode,
  findKonquerorBookmarkNodeWithParent,
  getKonquerorBookmarkChildren,
  getKonquerorBookmarkNode,
  moveKonquerorBookmarkNode,
  recordKonquerorBookmarkVisit,
  reorderKonquerorBookmarkChild,
  updateKonquerorBookmark,
  updateKonquerorBookmarkFolder,
} from "./bookmarks";

const expectOk = <T extends { readonly ok: boolean }>(result: T): Extract<T, { readonly ok: true }> => {
  if (!result.ok) throw new Error(`Expected success: ${"reason" in result ? result.reason : "unknown"}`);
  return result as Extract<T, { readonly ok: true }>;
};

const bookmark = (id: string, name = id, location = `/home/user/${id}`) => createKonquerorBookmark({ name, location, comment: "" }, id);
const folder = (id: string, name = id) => createKonquerorBookmarkFolder({ name }, id);

describe("Konqueror bookmark tree", () => {
  it("starts empty and accepts ordered root bookmarks and folders with generic location strings", () => {
    const root = createInitialKonquerorBookmarkTree();
    const first = expectOk(addKonquerorBookmark(root, bookmark("bookmark-a", "Home", "/home/aoi"))).tree;
    const second = expectOk(addKonquerorBookmarkFolder(first, folder("folder-work", "Work"))).tree;
    const third = expectOk(addKonquerorBookmark(second, bookmark("bookmark-web", "Example", "https://example.com"))).tree;

    expect(root).toEqual({ rootChildren: [] });
    expect(third.rootChildren.map((node) => [node.id, node.type])).toEqual([
      ["bookmark-a", "bookmark"],
      ["folder-work", "folder"],
      ["bookmark-web", "bookmark"],
    ]);
    expect(getKonquerorBookmarkNode(third, "bookmark-web")).toMatchObject({ location: "https://example.com", visitCount: 0, firstViewed: null });
  });

  it("builds nested hierarchy, updates bookmark fields and folder names without changing stable IDs", () => {
    const withFolder = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a", "A"))).tree;
    const withNested = expectOk(addKonquerorBookmarkFolder(withFolder, folder("folder-b", "B"), "folder-a")).tree;
    const withBookmark = expectOk(addKonquerorBookmark(withNested, bookmark("bookmark-c", "C", "/home/aoi/Documents/test.txt"), "folder-b")).tree;
    const renamedFolder = expectOk(updateKonquerorBookmarkFolder(withBookmark, "folder-a", { name: "Renamed A" })).tree;
    const updatedBookmark = expectOk(updateKonquerorBookmark(renamedFolder, "bookmark-c", {
      name: "Updated C",
      location: "http://example.com",
      comment: "saved location",
    })).tree;

    expect(getKonquerorBookmarkNode(updatedBookmark, "folder-a")).toMatchObject({ id: "folder-a", name: "Renamed A" });
    expect(getKonquerorBookmarkNode(updatedBookmark, "bookmark-c")).toMatchObject({
      id: "bookmark-c",
      name: "Updated C",
      location: "http://example.com",
      comment: "saved location",
    });
    expect(findKonquerorBookmarkNodeWithParent(updatedBookmark, "bookmark-c")).toMatchObject({ parentId: "folder-b" });
  });

  it("deletes a folder and all descendants by removing its single parent reference", () => {
    const withFolder = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a"))).tree;
    const withNested = expectOk(addKonquerorBookmarkFolder(withFolder, folder("folder-b"), "folder-a")).tree;
    const tree = expectOk(addKonquerorBookmark(withNested, bookmark("bookmark-c"), "folder-b")).tree;
    const deleted = expectOk(deleteKonquerorBookmarkNode(tree, "folder-a")).tree;

    expect(deleted.rootChildren).toEqual([]);
    expect(getKonquerorBookmarkNode(deleted, "folder-a")).toBeNull();
    expect(getKonquerorBookmarkNode(deleted, "bookmark-c")).toBeNull();
  });

  it("deletes a direct bookmark without changing its remaining siblings", () => {
    const first = expectOk(addKonquerorBookmark(createInitialKonquerorBookmarkTree(), bookmark("bookmark-a"))).tree;
    const tree = expectOk(addKonquerorBookmark(first, bookmark("bookmark-b"))).tree;
    const deleted = expectOk(deleteKonquerorBookmarkNode(tree, "bookmark-a")).tree;

    expect(getKonquerorBookmarkNode(deleted, "bookmark-a")).toBeNull();
    expect(deleted.rootChildren.map((node) => node.id)).toEqual(["bookmark-b"]);
    expect(getKonquerorBookmarkNode(deleted, "bookmark-b")).toMatchObject({ id: "bookmark-b", location: "/home/user/bookmark-b" });
  });

  it("deletes a nested folder with its descendants while preserving the parent folder", () => {
    const withParent = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a", "A"))).tree;
    const withNested = expectOk(addKonquerorBookmarkFolder(withParent, folder("folder-b", "B"), "folder-a")).tree;
    const tree = expectOk(addKonquerorBookmark(withNested, bookmark("bookmark-c", "C"), "folder-b")).tree;
    const deleted = expectOk(deleteKonquerorBookmarkNode(tree, "folder-b")).tree;

    expect(getKonquerorBookmarkNode(deleted, "folder-a")).toMatchObject({ id: "folder-a", name: "A", children: [] });
    expect(getKonquerorBookmarkNode(deleted, "folder-b")).toBeNull();
    expect(getKonquerorBookmarkNode(deleted, "bookmark-c")).toBeNull();
    expect(deleted.rootChildren).toHaveLength(1);
  });

  it("moves nodes without changing identity, keeps one parent reference, and rejects cycles", () => {
    const first = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a"))).tree;
    const second = expectOk(addKonquerorBookmarkFolder(first, folder("folder-b"))).tree;
    const nested = expectOk(addKonquerorBookmarkFolder(second, folder("folder-c"), "folder-a")).tree;
    const withBookmark = expectOk(addKonquerorBookmark(nested, bookmark("bookmark-d"), "folder-a")).tree;
    const moved = expectOk(moveKonquerorBookmarkNode(withBookmark, "bookmark-d", "folder-b")).tree;

    expect(findKonquerorBookmarkNodeWithParent(moved, "bookmark-d")).toMatchObject({ parentId: "folder-b", node: { id: "bookmark-d" } });
    expect(getKonquerorBookmarkChildren(moved, "folder-a")?.map((node) => node.id)).toEqual(["folder-c"]);
    expect(moveKonquerorBookmarkNode(moved, "folder-a", "folder-c")).toEqual({ ok: false, reason: "cycle" });
    expect(moveKonquerorBookmarkNode(moved, "folder-a", "folder-a")).toEqual({ ok: false, reason: "cycle" });
  });

  it("moves a folder between parents without changing its identity or child data", () => {
    const withA = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a"))).tree;
    const withB = expectOk(addKonquerorBookmarkFolder(withA, folder("folder-b"))).tree;
    const withC = expectOk(addKonquerorBookmarkFolder(withB, folder("folder-c", "C"), "folder-a")).tree;
    const tree = expectOk(addKonquerorBookmark(withC, bookmark("bookmark-d", "Saved", "https://example.com"), "folder-c")).tree;
    const moved = expectOk(moveKonquerorBookmarkNode(tree, "folder-c", "folder-b")).tree;

    expect(getKonquerorBookmarkChildren(moved, "folder-a")).toEqual([]);
    expect(findKonquerorBookmarkNodeWithParent(moved, "folder-c")).toMatchObject({ parentId: "folder-b", node: {
      id: "folder-c",
      type: "folder",
      name: "C",
      children: [{ id: "bookmark-d", type: "bookmark", name: "Saved", location: "https://example.com" }],
    } });
    expect(JSON.stringify(moved).match(/"id":"folder-c"/g)).toHaveLength(1);
  });

  it("rejects a bookmark as a move destination without changing the tree", () => {
    const withFolder = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a"))).tree;
    const tree = expectOk(addKonquerorBookmark(withFolder, bookmark("bookmark-b"))).tree;

    expect(moveKonquerorBookmarkNode(tree, "folder-a", "bookmark-b")).toEqual({ ok: false, reason: "parent-is-not-folder" });
    expect(tree).toEqual({
      rootChildren: [
        { id: "folder-a", type: "folder", name: "folder-a", children: [] },
        { id: "bookmark-b", type: "bookmark", name: "bookmark-b", location: "/home/user/bookmark-b", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
      ],
    });
  });

  it("reorders only direct siblings and preserves deterministic child order", () => {
    const first = expectOk(addKonquerorBookmark(createInitialKonquerorBookmarkTree(), bookmark("bookmark-a"))).tree;
    const second = expectOk(addKonquerorBookmark(first, bookmark("bookmark-b"))).tree;
    const third = expectOk(addKonquerorBookmark(second, bookmark("bookmark-c"))).tree;
    const reordered = expectOk(reorderKonquerorBookmarkChild(third, null, "bookmark-c", 0)).tree;

    expect(reordered.rootChildren.map((node) => node.id)).toEqual(["bookmark-c", "bookmark-a", "bookmark-b"]);
    expect(reorderKonquerorBookmarkChild(reordered, null, "missing", 0)).toEqual({ ok: false, reason: "node-not-found" });
  });

  it("reorders a visited bookmark without changing any of its data", () => {
    const first = expectOk(addKonquerorBookmark(createInitialKonquerorBookmarkTree(), bookmark("bookmark-a"))).tree;
    const detailed = createKonquerorBookmark({ name: "Reference", location: "https://example.com/path", comment: "keep this metadata" }, "bookmark-b");
    const withDetailed = expectOk(addKonquerorBookmark(first, detailed)).tree;
    const visited = expectOk(recordKonquerorBookmarkVisit(withDetailed, "bookmark-b", "2026-09-07T00:00:00.000Z")).tree;
    const reordered = expectOk(reorderKonquerorBookmarkChild(visited, null, "bookmark-b", 0)).tree;

    expect(reordered.rootChildren.map((node) => node.id)).toEqual(["bookmark-b", "bookmark-a"]);
    expect(getKonquerorBookmarkNode(reordered, "bookmark-b")).toEqual({
      ...detailed,
      firstViewed: "2026-09-07T00:00:00.000Z",
      lastViewed: "2026-09-07T00:00:00.000Z",
      visitCount: 1,
    });
  });

  it("records visits without treating creation as an initial visit", () => {
    const created = expectOk(addKonquerorBookmark(createInitialKonquerorBookmarkTree(), bookmark("bookmark-a"))).tree;
    const firstVisit = expectOk(recordKonquerorBookmarkVisit(created, "bookmark-a", "2026-09-07T00:00:00.000Z")).tree;
    const secondVisit = expectOk(recordKonquerorBookmarkVisit(firstVisit, "bookmark-a", "2026-09-07T01:00:00.000Z")).tree;

    expect(getKonquerorBookmarkNode(created, "bookmark-a")).toMatchObject({ visitCount: 0, firstViewed: null, lastViewed: null });
    expect(getKonquerorBookmarkNode(firstVisit, "bookmark-a")).toMatchObject({
      firstViewed: "2026-09-07T00:00:00.000Z",
      lastViewed: "2026-09-07T00:00:00.000Z",
      visitCount: 1,
    });
    expect(getKonquerorBookmarkNode(secondVisit, "bookmark-a")).toMatchObject({
      firstViewed: "2026-09-07T00:00:00.000Z",
      lastViewed: "2026-09-07T01:00:00.000Z",
      visitCount: 2,
    });
  });

  it("preserves visit metadata when bookmark fields are updated", () => {
    const created = expectOk(addKonquerorBookmark(createInitialKonquerorBookmarkTree(), bookmark("bookmark-a"))).tree;
    const visited = expectOk(recordKonquerorBookmarkVisit(created, "bookmark-a", "2026-09-07T00:00:00.000Z")).tree;
    const updated = expectOk(updateKonquerorBookmark(visited, "bookmark-a", {
      name: "Updated",
      location: "https://example.com/updated",
      comment: "updated comment",
    })).tree;

    expect(getKonquerorBookmarkNode(updated, "bookmark-a")).toMatchObject({
      name: "Updated",
      location: "https://example.com/updated",
      comment: "updated comment",
      firstViewed: "2026-09-07T00:00:00.000Z",
      lastViewed: "2026-09-07T00:00:00.000Z",
      visitCount: 1,
    });
  });

  it("preserves visit metadata when a bookmark moves between folders", () => {
    const withA = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), folder("folder-a"))).tree;
    const withB = expectOk(addKonquerorBookmarkFolder(withA, folder("folder-b"))).tree;
    const withBookmark = expectOk(addKonquerorBookmark(withB, bookmark("bookmark-c"), "folder-a")).tree;
    const visited = expectOk(recordKonquerorBookmarkVisit(withBookmark, "bookmark-c", "2026-09-07T00:00:00.000Z")).tree;
    const moved = expectOk(moveKonquerorBookmarkNode(visited, "bookmark-c", "folder-b")).tree;

    expect(findKonquerorBookmarkNodeWithParent(moved, "bookmark-c")).toMatchObject({ parentId: "folder-b", node: {
      firstViewed: "2026-09-07T00:00:00.000Z",
      lastViewed: "2026-09-07T00:00:00.000Z",
      visitCount: 1,
    } });
  });

  it("rejects duplicate identities and non-folder destinations", () => {
    const first = expectOk(addKonquerorBookmark(createInitialKonquerorBookmarkTree(), bookmark("bookmark-a"))).tree;

    expect(addKonquerorBookmark(first, bookmark("bookmark-a"))).toEqual({ ok: false, reason: "duplicate-id" });
    expect(addKonquerorBookmark(first, bookmark("bookmark-b"), "bookmark-a")).toEqual({ ok: false, reason: "parent-is-not-folder" });
  });

  it("inserts a complete Folder subtree atomically while rejecting duplicate IDs within that subtree", () => {
    const session = createKonquerorBookmarkFolder(
      { name: "Session" },
      "folder-session",
      [bookmark("bookmark-first", "First", "/home/user"), bookmark("bookmark-second", "Second", "https://example.com")],
    );
    const inserted = expectOk(addKonquerorBookmarkFolder(createInitialKonquerorBookmarkTree(), session)).tree;
    const duplicateChild = createKonquerorBookmarkFolder(
      { name: "Invalid" },
      "folder-invalid",
      [bookmark("bookmark-duplicate"), bookmark("bookmark-duplicate")],
    );

    expect(inserted.rootChildren).toEqual([expect.objectContaining({
      id: "folder-session",
      children: [
        expect.objectContaining({ id: "bookmark-first", location: "/home/user", visitCount: 0, firstViewed: null, lastViewed: null }),
        expect.objectContaining({ id: "bookmark-second", location: "https://example.com", visitCount: 0, firstViewed: null, lastViewed: null }),
      ],
    })]);
    expect(addKonquerorBookmarkFolder(inserted, duplicateChild)).toEqual({ ok: false, reason: "duplicate-id" });
    expect(inserted.rootChildren).toHaveLength(1);
  });
});
