import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsDirectoryNode } from "../../vfs/types";
import { createKonquerorAboutLocationTarget } from "./navigationTypes";
import { getKonquerorTaskIconId } from "./taskIcon";

describe("Konqueror task semantic icon", () => {
  it("maps virtual locations and both Start Page presentations without consulting captions", () => {
    const state = createInitialVfsState();

    expect(getKonquerorTaskIconId(state, createKonquerorAboutLocationTarget("blank"))).toBe("konqueror");
    expect(getKonquerorTaskIconId(state, createKonquerorAboutLocationTarget("canonical"))).toBe("konqueror");
    expect(getKonquerorTaskIconId(state, { type: "sysinfo" })).toBe("my-computer");
    expect(getKonquerorTaskIconId(state, { type: "external-web", canonicalUrl: "https://example.com/" })).toBe("konqueror");
    expect(getKonquerorTaskIconId(state, null)).toBe("konqueror");
  });

  it("reuses stable VFS node semantics for canonical and ordinary directories", () => {
    const state = createInitialVfsState();
    const ordinaryDocuments: VfsDirectoryNode = {
      id: "vfs-ordinary-documents",
      name: "Documents",
      parentId: state.specialLocations.home,
      kind: "directory",
      childIds: [],
      createdAt: "2004-08-25T12:00:00.000Z",
      modifiedAt: "2004-08-25T12:00:00.000Z",
    };
    const withOrdinaryDocuments = {
      ...state,
      nodesById: { ...state.nodesById, [ordinaryDocuments.id]: ordinaryDocuments },
    };

    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.home })).toBe("home");
    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.documents })).toBe("documents");
    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.downloads })).toBe("downloads");
    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.music })).toBe("music");
    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.pictures })).toBe("pictures");
    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.videos })).toBe("videos");
    expect(getKonquerorTaskIconId(withOrdinaryDocuments, { type: "directory", nodeId: ordinaryDocuments.id })).toBe("folder");
  });

  it("maps Trash root to Trash while nested directories and files use their v1 fallbacks", () => {
    const state = createInitialVfsState();
    const nestedTrashDirectory: VfsDirectoryNode = {
      id: "vfs-trash-folder",
      name: "Old Folder",
      parentId: state.specialLocations.trash,
      kind: "directory",
      childIds: [],
      createdAt: "2004-08-25T12:00:00.000Z",
      modifiedAt: "2004-08-25T12:00:00.000Z",
    };
    const withNestedTrashDirectory = {
      ...state,
      nodesById: { ...state.nodesById, [nestedTrashDirectory.id]: nestedTrashDirectory },
    };

    expect(getKonquerorTaskIconId(state, { type: "directory", nodeId: state.specialLocations.trash })).toBe("trash");
    expect(getKonquerorTaskIconId(withNestedTrashDirectory, { type: "directory", nodeId: nestedTrashDirectory.id })).toBe("folder");
    expect(getKonquerorTaskIconId(state, { type: "file", nodeId: "vfs-content-76cff3ce17d8a853403179f1", previewerId: "khtml" })).toBe("konqueror");
    expect(getKonquerorTaskIconId(state, { type: "file", nodeId: "missing-file" })).toBe("konqueror");
  });
});
