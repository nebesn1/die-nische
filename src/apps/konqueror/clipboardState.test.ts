import { describe, expect, it } from "vitest";
import { initialKonquerorClipboardState, konquerorClipboardReducer } from "./clipboardState";

describe("Konqueror clipboard state", () => {
  it("starts empty", () => {
    expect(initialKonquerorClipboardState).toEqual({ kind: "empty" });
  });

  it("captures an immutable ordered multi-item copy or cut snapshot", () => {
    const copied = konquerorClipboardReducer(initialKonquerorClipboardState, {
      type: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" },
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: "vfs-documents" },
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1", "vfs-content-e594a065214576326cb903a5"],
    });
    const cut = konquerorClipboardReducer(copied, {
      type: "cut",
      entries: [
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: "vfs-pictures" },
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" },
      ],
      displayNodeIds: ["vfs-content-76cff3ce17d8a853403179f1", "vfs-content-e594a065214576326cb903a5"],
    });

    expect(copied).toEqual({
      kind: "items",
      mode: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" },
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: "vfs-documents" },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
    });
    expect(cut).toEqual({
      kind: "items",
      mode: "cut",
      entries: [
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: "vfs-pictures" },
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" },
      ],
      displayNodeIds: ["vfs-content-76cff3ce17d8a853403179f1", "vfs-content-e594a065214576326cb903a5"],
    });
  });

  it("clears without mutating the captured snapshot", () => {
    const copied = konquerorClipboardReducer(initialKonquerorClipboardState, {
      type: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" },
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: "vfs-documents" },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
    });
    expect(konquerorClipboardReducer(copied, { type: "clear" })).toEqual({ kind: "empty" });
    expect(copied).toMatchObject({ kind: "items", entries: [
      { nodeId: "vfs-content-e594a065214576326cb903a5" },
      { nodeId: "vfs-content-76cff3ce17d8a853403179f1" },
    ] });
  });
});
