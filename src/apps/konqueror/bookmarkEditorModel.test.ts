import { describe, expect, it } from "vitest";
import { getBookmarkEditorSiblingPosition, getBookmarkEditorTreeRows } from "./bookmarkEditorModel";
import type { KonquerorBookmarkTree } from "./bookmarks";

const tree: KonquerorBookmarkTree = {
  rootChildren: [
    { id: "a", type: "bookmark", name: "Alpha", location: "/home/user", comment: "first", firstViewed: null, lastViewed: null, visitCount: 0 },
    { id: "work", type: "folder", name: "Work", children: [
      { id: "robotics", type: "folder", name: "Robotics", children: [
        { id: "ros", type: "bookmark", name: "ROS Docs", location: "https://ros.org", comment: "middleware", firstViewed: null, lastViewed: null, visitCount: 0 },
      ] },
    ] },
    { id: "c", type: "bookmark", name: "Charlie", location: "/home/user/Documents", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
  ],
};

describe("Bookmark Editor tree projection", () => {
  it("preserves mixed tree order and uses only expanded Folder IDs in normal mode", () => {
    expect(getBookmarkEditorTreeRows(tree, new Set(["work"]), "").map((row) => row.id)).toEqual([null, "a", "work", "robotics", "c"]);
    expect(getBookmarkEditorTreeRows(tree, new Set(["work", "robotics"]), "").map((row) => row.id)).toEqual([null, "a", "work", "robotics", "ros", "c"]);
  });

  it("searches bookmark name, location, comment, and preserves ancestor context", () => {
    expect(getBookmarkEditorTreeRows(tree, new Set(), "middleware").map((row) => row.id)).toEqual([null, "work", "robotics", "ros"]);
    expect(getBookmarkEditorTreeRows(tree, new Set(), "DOCUMENTS").map((row) => row.id)).toEqual([null, "c"]);
    expect(getBookmarkEditorTreeRows(tree, new Set(), "work").map((row) => row.id)).toEqual([null, "work", "robotics", "ros"]);
  });

  it("derives the real mixed sibling position by stable node ID", () => {
    expect(getBookmarkEditorSiblingPosition(tree, "work")).toEqual({ parentId: null, index: 1, siblingCount: 3 });
    expect(getBookmarkEditorSiblingPosition(tree, "ros")).toEqual({ parentId: "robotics", index: 0, siblingCount: 1 });
    expect(getBookmarkEditorSiblingPosition(tree, "missing")).toBeNull();
  });

  it("keeps a deep mixed projection stable for expansion and ancestor search", () => {
    const deepTree: KonquerorBookmarkTree = {
      rootChildren: [
        ...Array.from({ length: 30 }, (_, index) => ({
          id: `root-${index}`,
          type: "bookmark" as const,
          name: index === 15 ? "Duplicate" : `Bookmark ${index}`,
          location: `/home/user/${index}`,
          comment: "",
          firstViewed: null,
          lastViewed: null,
          visitCount: 0,
        })),
        { id: "a", type: "folder", name: "A", children: [{ id: "b", type: "folder", name: "B", children: [{ id: "c", type: "folder", name: "C", children: [{ id: "d", type: "folder", name: "D", children: [{ id: "e", type: "folder", name: "E", children: [{ id: "deep-leaf", type: "bookmark", name: "Duplicate", location: "https://example.com/deep", comment: "deep", firstViewed: null, lastViewed: null, visitCount: 0 }] }] }] }] }] },
      ],
    };

    expect(getBookmarkEditorTreeRows(deepTree, new Set(["a", "b", "c", "d", "e"]), "").map((row) => row.id).slice(-6)).toEqual(["a", "b", "c", "d", "e", "deep-leaf"]);
    expect(getBookmarkEditorTreeRows(deepTree, new Set(), "https://example.com/deep").map((row) => row.id)).toEqual([null, "a", "b", "c", "d", "e", "deep-leaf"]);
  });
});
