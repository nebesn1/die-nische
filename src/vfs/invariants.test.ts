import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { validateVfsState } from "./invariants";
import { createVfsDirectory, moveVfsNodeToTrash, restoreVfsNodeFromTrash, copyVfsNode, deleteVfsNodePermanently } from "./mutations";
import type { VfsDirectoryNode, VfsState, VfsTextFileNode } from "./types";

const codes = (state: VfsState): readonly string[] => validateVfsState(state).map((violation) => violation.code);

describe("VFS invariants", () => {
  it("accepts the initial state", () => {
    expect(validateVfsState(createInitialVfsState())).toEqual([]);
  });

  it("detects root and parent problems", () => {
    const state = createInitialVfsState();
    const rootAsFile: VfsTextFileNode = {
      ...state.nodesById[state.rootId],
      kind: "file",
      encoding: "utf-8",
      mimeType: "text/plain",
      content: { kind: "text", text: "" },
      size: 0,
    };
    const invalidRootState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [state.rootId]: rootAsFile,
      },
    };
    const parentlessNodeState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        "orphan-root": {
          ...state.nodesById["vfs-documents"],
          id: "orphan-root",
          parentId: null,
        },
      },
    };

    expect(codes({ ...state, rootId: "missing" })).toContain("MISSING_ROOT");
    expect(codes(invalidRootState)).toContain("ROOT_NOT_DIRECTORY");
    expect(codes(parentlessNodeState)).toContain("NON_ROOT_WITHOUT_PARENT");
  });

  it("detects invalid child relationships and duplicate names", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById["vfs-documents"] as VfsDirectoryNode;
    const duplicateChildState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [documents.id]: {
          ...documents,
          childIds: [...documents.childIds, "vfs-content-76cff3ce17d8a853403179f1"],
        },
      },
    };
    const duplicateNameState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        "vfs-content-e594a065214576326cb903a5": {
          ...state.nodesById["vfs-content-e594a065214576326cb903a5"],
          name: "Welcome.md",
        },
      },
    };
    const parentMismatchState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        "vfs-content-e594a065214576326cb903a5": {
          ...state.nodesById["vfs-content-e594a065214576326cb903a5"],
          parentId: "vfs-user",
        },
      },
    };

    expect(codes(duplicateChildState)).toContain("DUPLICATE_CHILD_ID");
    expect(codes(duplicateNameState)).toContain("DUPLICATE_CHILD_NAME");
    expect(codes(parentMismatchState)).toContain("CHILD_PARENT_MISMATCH");
  });

  it("detects orphan nodes, special location problems, file size mismatches, and next id collisions", () => {
    const state = createInitialVfsState();
    const welcome = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"] as VfsTextFileNode;
    const orphanState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        "orphan": {
          ...state.nodesById["vfs-content-e594a065214576326cb903a5"],
          id: "orphan",
          parentId: "vfs-documents",
        },
      },
    };
    const specialFileState: VfsState = {
      ...state,
      specialLocations: {
        ...state.specialLocations,
        documents: "vfs-content-76cff3ce17d8a853403179f1",
      },
    };
    const wrongSizeState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        "vfs-content-76cff3ce17d8a853403179f1": {
          ...welcome,
          size: 999,
        },
      },
    };
    const collisionState: VfsState = {
      ...state,
      nextNodeSequence: 10,
      nodesById: {
        ...state.nodesById,
        "vfs-node-0010": {
          ...state.nodesById["vfs-content-e594a065214576326cb903a5"],
          id: "vfs-node-0010",
        },
      },
    };

    expect(codes(orphanState)).toContain("ORPHAN_NODE");
    expect(codes(specialFileState)).toContain("SPECIAL_LOCATION_NOT_DIRECTORY");
    expect(codes(wrongSizeState)).toContain("FILE_SIZE_MISMATCH");
    expect(codes(collisionState)).toContain("NEXT_NODE_ID_COLLISION");
  });

  it("accepts asset-backed file metadata while rejecting an invalid asset reference", () => {
    const state = createInitialVfsState();
    const image = Object.values(state.nodesById).find((node) =>
      node.kind === "file" && node.parentId === state.specialLocations.pictures && node.content.kind === "asset-url",
    );
    if (!image || image.kind !== "file" || image.content.kind !== "asset-url") throw new Error("Image fixture missing");
    const invalid: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [image.id]: { ...image, content: { kind: "asset-url", url: "" } },
      },
    };

    expect(codes(state)).not.toContain("INVALID_ASSET_FILE");
    expect(codes(invalid)).toContain("INVALID_ASSET_FILE");
  });

  it("detects parent cycles outside the root tree", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById["vfs-documents"] as VfsDirectoryNode;
    const downloads = state.nodesById["vfs-downloads"] as VfsDirectoryNode;
    const cycleState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        "cycle-a": {
          ...documents,
          id: "cycle-a",
          parentId: "cycle-b",
          childIds: ["cycle-b"],
        },
        "cycle-b": {
          ...downloads,
          id: "cycle-b",
          name: "cycle-b",
          parentId: "cycle-a",
          childIds: ["cycle-a"],
        },
      },
    };

    expect(codes(cycleState)).toContain("PARENT_CYCLE");
  });

  it("accepts legal move copy trash restore and permanent delete states", () => {
    const created = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Project", {
      now: "2026-08-02T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("fixture create failed");
    }

    const copied = copyVfsNode(created.state, "/home/user/Documents/Project", "/home/user/Downloads", {
      now: "2026-08-02T00:00:00.000Z",
    });

    if (!copied.ok) {
      throw new Error("fixture copy failed");
    }

    const trashed = moveVfsNodeToTrash(copied.state, "/home/user/Downloads/Project", {
      now: "2026-08-02T00:00:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("fixture trash failed");
    }

    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, {
      now: "2026-08-02T00:00:00.000Z",
    });

    if (!restored.ok) {
      throw new Error("fixture restore failed");
    }

    const trashedAgain = moveVfsNodeToTrash(restored.state, "/home/user/Downloads/Project", {
      now: "2026-08-02T00:00:00.000Z",
    });

    if (!trashedAgain.ok) {
      throw new Error("fixture trash again failed");
    }

    const deleted = deleteVfsNodePermanently(trashedAgain.state, trashedAgain.value.id, {
      now: "2026-08-02T00:00:00.000Z",
    });

    if (!deleted.ok) {
      throw new Error("fixture delete failed");
    }

    expect(validateVfsState(copied.state)).toEqual([]);
    expect(validateVfsState(trashed.state)).toEqual([]);
    expect(validateVfsState(restored.state)).toEqual([]);
    expect(validateVfsState(deleted.state)).toEqual([]);
  });

  it("detects invalid Trash metadata relationships", () => {
    const state = createInitialVfsState();
    const missingMetadata: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [state.specialLocations.trash]: {
          ...(state.nodesById[state.specialLocations.trash] as VfsDirectoryNode),
          childIds: ["vfs-content-76cff3ce17d8a853403179f1"],
        },
        "vfs-content-76cff3ce17d8a853403179f1": {
          ...state.nodesById["vfs-content-76cff3ce17d8a853403179f1"],
          parentId: state.specialLocations.trash,
        },
      },
    };
    const nonTrashEntry: VfsState = {
      ...state,
      trashEntriesByNodeId: {
        "vfs-content-76cff3ce17d8a853403179f1": {
          nodeId: "vfs-content-76cff3ce17d8a853403179f1",
          originalParentId: state.specialLocations.documents,
          originalName: "Welcome.md",
          trashedAt: "2026-08-02T00:00:00.000Z",
        },
      },
    };
    const invalidOriginalName: VfsState = {
      ...missingMetadata,
      trashEntriesByNodeId: {
        "vfs-content-76cff3ce17d8a853403179f1": {
          nodeId: "vfs-content-76cff3ce17d8a853403179f1",
          originalParentId: "vfs-content-76cff3ce17d8a853403179f1",
          originalName: "bad/name",
          trashedAt: "2026-08-02T00:00:00.000Z",
        },
      },
    };

    expect(codes(missingMetadata)).toContain("TRASH_CHILD_MISSING_ENTRY");
    expect(codes(nonTrashEntry)).toContain("TRASH_ENTRY_NOT_DIRECT_CHILD");
    expect(codes(nonTrashEntry)).toContain("NON_TRASH_CHILD_HAS_ENTRY");
    expect(codes(invalidOriginalName)).toContain("TRASH_ENTRY_SELF_PARENT");
    expect(codes(invalidOriginalName)).toContain("TRASH_ENTRY_INVALID_ORIGINAL_NAME");
  });
});
