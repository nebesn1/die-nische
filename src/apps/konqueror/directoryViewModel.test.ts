import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { VfsNode } from "../../vfs/types";
import {
  canAdjustKonquerorResourceZoom,
  createInitialKonquerorDirectoryViewState,
  defaultKonquerorDirectoryViewState,
  getKonquerorAdjacentSelectionId,
  getNextKonquerorResourceZoomLevel,
  getKonquerorResourceZoomLevel,
  konquerorDirectoryViewReducer,
  sortKonquerorEntries,
} from "./directoryViewModel";

const directory = (id: string, name: string, modifiedAt = "2026-08-12T00:00:00.000Z"): VfsNode => ({
  id,
  name,
  kind: "directory",
  parentId: "parent",
  childIds: [],
  createdAt: modifiedAt,
  modifiedAt,
});

const file = (id: string, name: string, size: number, modifiedAt = "2026-08-12T00:00:00.000Z"): VfsNode => ({
  id,
  name,
  kind: "file",
  parentId: "parent",
  mimeType: "text/plain",
  encoding: "utf-8",
  content: { kind: "text", text: "x" },
  size,
  createdAt: modifiedAt,
  modifiedAt,
});

describe("Konqueror directory view model", () => {
  it("starts in Tree View with independent normal zoom levels and Name ascending state", () => {
    expect(defaultKonquerorDirectoryViewState).toEqual({
      viewMode: "tree",
      iconZoomLevel: "normal",
      treeZoomLevel: "normal",
      sort: { key: "name", direction: "ascending" },
      expandedTreeNodeIds: [],
    });
  });

  it("seeds one instance state from Resource presentation preferences without persisting sort", () => {
    const icons = createInitialKonquerorDirectoryViewState({
      viewMode: "icons",
      treeZoomLevel: "small",
      iconZoomLevel: "large",
    });

    expect(icons).toEqual({
      ...defaultKonquerorDirectoryViewState,
      viewMode: "icons",
      treeZoomLevel: "small",
      iconZoomLevel: "large",
    });
    expect(icons.sort).not.toBe(defaultKonquerorDirectoryViewState.sort);
  });

  it("derives the next formal Resource zoom level without coupling Tree and Icon state", () => {
    expect(getNextKonquerorResourceZoomLevel("small", "out")).toBe("small");
    expect(getNextKonquerorResourceZoomLevel("small", "in")).toBe("normal");
    expect(getNextKonquerorResourceZoomLevel("large", "in")).toBe("extra-large");
    expect(getNextKonquerorResourceZoomLevel("extra-large", "in")).toBe("extra-large");
  });

  it("changes view independently from the sort descriptor", () => {
    const icons = konquerorDirectoryViewReducer(defaultKonquerorDirectoryViewState, {
      type: "set-view-mode",
      viewMode: "icons",
    });
    const modified = konquerorDirectoryViewReducer(icons, { type: "select-sort-key", key: "modified" });

    expect(icons.sort).toBe(defaultKonquerorDirectoryViewState.sort);
    expect(modified).toEqual({
      viewMode: "icons",
      iconZoomLevel: "normal",
      treeZoomLevel: "normal",
      sort: { key: "modified", direction: "ascending" },
      expandedTreeNodeIds: [],
    });
  });

  it("toggles an active header and resets a newly selected key to ascending", () => {
    const descending = konquerorDirectoryViewReducer(defaultKonquerorDirectoryViewState, {
      type: "select-sort-key",
      key: "name",
    });
    const size = konquerorDirectoryViewReducer(descending, { type: "select-sort-key", key: "size" });

    expect(descending.sort).toEqual({ key: "name", direction: "descending" });
    expect(size.sort).toEqual({ key: "size", direction: "ascending" });
  });

  it("sets an explicit menu direction without changing the selected sort key", () => {
    const descending = konquerorDirectoryViewReducer(defaultKonquerorDirectoryViewState, {
      type: "set-sort-direction",
      direction: "descending",
    });

    expect(descending).toEqual({
      viewMode: "tree",
      iconZoomLevel: "normal",
      treeZoomLevel: "normal",
      sort: { key: "name", direction: "descending" },
      expandedTreeNodeIds: [],
    });
  });

  it("remembers separate Icon and Tree zoom levels with deterministic boundaries", () => {
    const icons = konquerorDirectoryViewReducer(defaultKonquerorDirectoryViewState, {
      type: "set-view-mode",
      viewMode: "icons",
    });
    const iconLarge = konquerorDirectoryViewReducer(
      konquerorDirectoryViewReducer(icons, { type: "zoom-in" }),
      { type: "zoom-in" },
    );
    const tree = konquerorDirectoryViewReducer(iconLarge, { type: "set-view-mode", viewMode: "tree" });
    const treeSmall = konquerorDirectoryViewReducer(tree, { type: "zoom-out" });
    const restoredIcon = konquerorDirectoryViewReducer(treeSmall, { type: "set-view-mode", viewMode: "icons" });

    expect(getKonquerorResourceZoomLevel(iconLarge)).toBe("extra-large");
    expect(getKonquerorResourceZoomLevel(tree)).toBe("normal");
    expect(getKonquerorResourceZoomLevel(treeSmall)).toBe("small");
    expect(getKonquerorResourceZoomLevel(restoredIcon)).toBe("extra-large");
    expect(canAdjustKonquerorResourceZoom(treeSmall, "out")).toBe(false);
    expect(canAdjustKonquerorResourceZoom(restoredIcon, "in")).toBe(false);
  });

  it("sorts names deterministically with directories first in either direction", () => {
    const entries = [file("f-b", "beta.txt", 2), directory("d-z", "Zeta"), file("f-a", "Alpha.txt", 1), directory("d-a", "alpha")];

    expect(sortKonquerorEntries(entries, { key: "name", direction: "ascending" }).map((node) => node.id)).toEqual([
      "d-a",
      "d-z",
      "f-a",
      "f-b",
    ]);
    expect(sortKonquerorEntries(entries, { key: "name", direction: "descending" }).map((node) => node.id)).toEqual([
      "d-z",
      "d-a",
      "f-b",
      "f-a",
    ]);
    expect(entries.map((node) => node.id)).toEqual(["f-b", "d-z", "f-a", "d-a"]);
  });

  it("uses UTF-8 byte size metadata and name ties for Size sort", () => {
    const entries = [file("f-z", "z.txt", 4), directory("d-b", "Beta"), file("f-a", "a.txt", 4), directory("d-a", "Alpha"), file("f-u", "unicode.txt", 6)];

    expect(sortKonquerorEntries(entries, { key: "size", direction: "ascending" }).map((node) => node.id)).toEqual([
      "d-a",
      "d-b",
      "f-a",
      "f-z",
      "f-u",
    ]);
    expect(sortKonquerorEntries(entries, { key: "size", direction: "descending" }).map((node) => node.id)).toEqual([
      "d-a",
      "d-b",
      "f-u",
      "f-z",
      "f-a",
    ]);
  });

  it("keeps directories first for Type and orders raw modified instants without display formatting", () => {
    const entries = [
      file("f-later", "later.txt", 2, "2026-08-12T02:00:00.000Z"),
      directory("d-z", "Zeta", "not-a-date"),
      file("f-invalid", "invalid.txt", 2, "not-a-date"),
      directory("d-a", "Alpha", "2026-08-12T01:00:00.000Z"),
      file("f-earlier", "earlier.txt", 2, "2026-08-12T01:00:00.000Z"),
    ];

    expect(sortKonquerorEntries(entries, { key: "type", direction: "ascending" }).slice(0, 2).map((node) => node.id)).toEqual([
      "d-a",
      "d-z",
    ]);
    expect(sortKonquerorEntries(entries, { key: "modified", direction: "descending" }).map((node) => node.id)).toEqual([
      "d-a",
      "d-z",
      "f-later",
      "f-earlier",
      "f-invalid",
    ]);
  });

  it("moves selection through the sorted live node ids without index state", () => {
    const entries = [directory("d-a", "Alpha"), file("f-a", "a.txt", 1), file("f-b", "b.txt", 2)];

    expect(getKonquerorAdjacentSelectionId(entries, [], "next")).toBe("d-a");
    expect(getKonquerorAdjacentSelectionId(entries, [], "previous")).toBe("f-b");
    expect(getKonquerorAdjacentSelectionId(entries, ["f-a"], "next")).toBe("f-b");
    expect(getKonquerorAdjacentSelectionId(entries, ["f-b"], "next")).toBe("f-b");
    expect(getKonquerorAdjacentSelectionId(entries, ["f-a"], "previous")).toBe("d-a");
    expect(getKonquerorAdjacentSelectionId(entries, ["d-a", "f-a"], "next")).toBe("d-a");
  });

  it("keeps nested expansion membership through a parent collapse and sanitizes stale directories", () => {
    const expanded = konquerorDirectoryViewReducer(
      konquerorDirectoryViewReducer(defaultKonquerorDirectoryViewState, { type: "toggle-tree-expansion", nodeId: "documents" }),
      { type: "toggle-tree-expansion", nodeId: "subfolder" },
    );
    const collapsedParent = konquerorDirectoryViewReducer(expanded, { type: "toggle-tree-expansion", nodeId: "documents" });
    const retained = konquerorDirectoryViewReducer(collapsedParent, {
      type: "retain-tree-expansion",
      directoryNodeIds: ["documents"],
    });

    expect(expanded.expandedTreeNodeIds).toEqual(["documents", "subfolder"]);
    expect(collapsedParent.expandedTreeNodeIds).toEqual(["subfolder"]);
    expect(retained.expandedTreeNodeIds).toEqual([]);
  });

  it("has no persistence, locale comparator, or VFS mutation boundary", () => {
    const source = readFileSync(new URL("./directoryViewModel.ts", import.meta.url), "utf8");

    expect(source).toContain("return [...entries].sort");
    expect(source).not.toContain("Intl.Collator");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("nodesById");
    expect(source).not.toContain("childIds:");
  });
});
