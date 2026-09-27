import { describe, expect, it } from "vitest";
import {
  addKonquerorSelectionRange,
  emptyKonquerorSelection,
  getInclusiveKonquerorSelectionRange,
  getKonquerorSelectedNodeIdsInVisibleOrder,
  getKonquerorSelectionPointerIntent,
  getSingleKonquerorSelectedNodeId,
  normalizeKonquerorSelection,
  replaceKonquerorSelection,
  retainKonquerorSelection,
  toggleKonquerorSelection,
} from "./selectionModel";

describe("Konqueror multi-selection model", () => {
  it("replaces selection with exactly one stable node id", () => {
    expect(replaceKonquerorSelection("vfs-documents")).toEqual(["vfs-documents"]);
  });

  it("toggles unique node membership deterministically", () => {
    const first = toggleKonquerorSelection(emptyKonquerorSelection, "vfs-documents");
    const second = toggleKonquerorSelection(first, "vfs-downloads");
    const third = toggleKonquerorSelection(second, "vfs-content-e594a065214576326cb903a5");
    const removed = toggleKonquerorSelection(third, "vfs-downloads");

    expect(first).toEqual(["vfs-documents"]);
    expect(second).toEqual(["vfs-documents", "vfs-downloads"]);
    expect(third).toEqual(["vfs-documents", "vfs-downloads", "vfs-content-e594a065214576326cb903a5"]);
    expect(removed).toEqual(["vfs-documents", "vfs-content-e594a065214576326cb903a5"]);
    expect(toggleKonquerorSelection(removed, "vfs-documents")).toEqual(["vfs-content-e594a065214576326cb903a5"]);
    expect(toggleKonquerorSelection(["vfs-content-e594a065214576326cb903a5"], "vfs-content-e594a065214576326cb903a5")).toEqual([]);
  });

  it("preserves immutable source arrays and retains only visible stable node ids", () => {
    const selection = ["vfs-documents", "vfs-downloads", "vfs-content-e594a065214576326cb903a5"] as const;
    const retained = retainKonquerorSelection(selection, ["vfs-documents", "vfs-content-e594a065214576326cb903a5"]);

    expect(selection).toEqual(["vfs-documents", "vfs-downloads", "vfs-content-e594a065214576326cb903a5"]);
    expect(retained).toEqual(["vfs-documents", "vfs-content-e594a065214576326cb903a5"]);
    expect(retainKonquerorSelection(retained, ["vfs-documents", "vfs-content-e594a065214576326cb903a5"])).toBe(retained);
  });

  it("normalizes externally supplied selection membership without retaining duplicates", () => {
    expect(normalizeKonquerorSelection(["vfs-content-e594a065214576326cb903a5", "vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1", "vfs-content-e594a065214576326cb903a5"])).toEqual([
      "vfs-content-e594a065214576326cb903a5",
      "vfs-content-76cff3ce17d8a853403179f1",
    ]);
  });

  it("returns a single command target only for an exact one-item selection", () => {
    expect(getSingleKonquerorSelectedNodeId([])).toBeNull();
    expect(getSingleKonquerorSelectedNodeId(["vfs-content-e594a065214576326cb903a5"])).toBe("vfs-content-e594a065214576326cb903a5");
    expect(getSingleKonquerorSelectedNodeId(["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"])).toBeNull();
  });

  it("projects batch operation targets through the current visible order", () => {
    expect(getKonquerorSelectedNodeIdsInVisibleOrder(["b", "d", "a", "missing"], ["d", "a", "c", "b"])).toEqual([
      "d",
      "a",
      "b",
    ]);
  });

  it("derives inclusive ranges exclusively from the supplied visible order", () => {
    const visibleNodeIds = ["d", "a", "c", "b", "e"];

    expect(getInclusiveKonquerorSelectionRange(visibleNodeIds, "a", "b")).toEqual(["a", "c", "b"]);
    expect(getInclusiveKonquerorSelectionRange(visibleNodeIds, "b", "a")).toEqual(["a", "c", "b"]);
    expect(getInclusiveKonquerorSelectionRange(visibleNodeIds, "c", "c")).toEqual(["c"]);
    expect(getInclusiveKonquerorSelectionRange(visibleNodeIds, "d", "e")).toEqual(visibleNodeIds);
    expect(getInclusiveKonquerorSelectionRange(visibleNodeIds, "missing", "b")).toBeNull();
    expect(getInclusiveKonquerorSelectionRange(visibleNodeIds, "a", "missing")).toBeNull();
  });

  it("adds a range without reordering existing membership or duplicating nodes", () => {
    expect(addKonquerorSelectionRange(["a", "c"], ["c", "d", "e", "f"])).toEqual(["a", "c", "d", "e", "f"]);
    expect(addKonquerorSelectionRange(["a", "a", "c"], ["c", "d", "d"])).toEqual(["a", "c", "d"]);
  });

  it("resolves primary pointer modifier priority without treating secondary buttons as selection", () => {
    expect(getKonquerorSelectionPointerIntent(0, false, false)).toBe("replace");
    expect(getKonquerorSelectionPointerIntent(0, true, false)).toBe("toggle");
    expect(getKonquerorSelectionPointerIntent(0, false, true)).toBe("replace-range");
    expect(getKonquerorSelectionPointerIntent(0, true, true)).toBe("add-range");
    expect(getKonquerorSelectionPointerIntent(2, true, true)).toBeNull();
  });
});
