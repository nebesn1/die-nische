import { describe, expect, it } from "vitest";
import { validateVfsState } from "./invariants";
import { createInitialVfsState } from "./initialState";
import {
  copyVfsNode,
  createVfsDirectory,
  createVfsTextFile,
  deleteVfsNodePermanently,
  emptyVfsTrash,
  moveVfsNode,
  moveVfsNodeToTrash,
  restoreVfsNodeFromTrash,
} from "./mutations";
import { getVfsPathForNode, listVfsDirectory, listVfsTrashEntries, readVfsTextFile } from "./queries";
import type { VfsDirectoryNode, VfsState } from "./types";

const now = "2026-08-02T00:00:00.000Z";
const later = "2026-08-02T00:01:00.000Z";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) {
    throw new Error("Expected ok mutation");
  }

  return {
    state: result.state,
    value: result.value,
  };
};

const createProjectTree = (): VfsState => {
  const project = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Project", { now }));
  const subfolder = expectMutation(createVfsDirectory(project.state, "/home/user/Documents/Project", "Subfolder", { now }));
  const file = expectMutation(createVfsTextFile(subfolder.state, "/home/user/Documents/Project/Subfolder", "Plan.txt", "中文", { now }));

  return file.state;
};

describe("VFS move and copy mutations", () => {
  it("moves files while preserving identity and appending to the destination", () => {
    const state = createInitialVfsState();
    const noteId = expectOk(readVfsTextFile(state, "/home/user/Documents/Notes.txt")).id;
    const oldFile = state.nodesById[noteId];
    const oldDocuments = state.nodesById[state.specialLocations.documents];
    const expectedDocumentChildIds = oldDocuments.kind === "directory" ? oldDocuments.childIds.filter((nodeId) => nodeId !== noteId) : [];
    const oldDownloads = state.nodesById[state.specialLocations.downloads];
    const moved = moveVfsNode(state, "/home/user/Documents/Notes.txt", "/home/user/Downloads", { now });

    expect(moved).toMatchObject({ ok: true, value: { id: noteId, parentId: state.specialLocations.downloads, name: "Notes.txt" } });

    if (!moved.ok) {
      throw new Error("move failed");
    }

    expect(expectOk(listVfsDirectory(moved.state, "/home/user/Documents")).map((node) => node.id)).toEqual(expectedDocumentChildIds);
    expect(expectOk(listVfsDirectory(moved.state, "/home/user/Downloads")).map((node) => node.id)).toEqual([noteId]);
    expect(moved.state.nodesById[noteId].id).toBe(oldFile.id);
    expect(moved.state.nodesById[noteId].createdAt).toBe(oldFile.createdAt);
    expect(moved.state.nodesById[noteId].modifiedAt).toBe(now);
    expect(moved.state.nodesById[state.specialLocations.documents]).not.toBe(oldDocuments);
    expect(moved.state.nodesById[state.specialLocations.downloads]).not.toBe(oldDownloads);
    expect(moved.state.nextNodeSequence).toBe(state.nextNodeSequence);
    expect(moved.state.revision).toBe(state.revision + 1);
    expect(validateVfsState(moved.state)).toEqual([]);
  });

  it("moves directories with unchanged subtree ids and supports same-directory rename/no-op", () => {
    const state = createProjectTree();
    const moved = expectMutation(moveVfsNode(state, "/home/user/Documents/Project", "/home/user/Downloads", { now }));
    const renamed = moveVfsNode(moved.state, "/home/user/Downloads/Project", "/home/user/Downloads", {
      now: later,
      newName: "Project Renamed",
    });
    const same = moveVfsNode(moved.state, "/home/user/Downloads/Project", "/home/user/Downloads", { now: later });

    expect(getVfsPathForNode(moved.state, "vfs-node-0012")).toMatchObject({
      ok: true,
      value: "/home/user/Downloads/Project/Subfolder/Plan.txt",
    });
    expect(renamed).toMatchObject({ ok: true, value: { id: "vfs-node-0010", name: "Project Renamed" } });
    expect(same).toMatchObject({ ok: true, state: moved.state });
  });

  it("rejects invalid move destinations and protected sources without mutation", () => {
    const state = createProjectTree();

    expect(moveVfsNode(state, "/home/user/Documents/Project", "/home/user/Documents/Project/Subfolder", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(moveVfsNode(state, "/home/user/Documents", "/home/user/Downloads", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" },
    });
    expect(moveVfsNode(state, "/home/user/Documents/Welcome.md", "/home/user/Documents/Notes.txt", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "NOT_DIRECTORY" },
    });
    expect(moveVfsNode(state, "/home/user/Documents/Welcome.md", "/home/user/Documents", { now, newName: "Notes.txt" })).toMatchObject({
      ok: false,
      state,
      error: { code: "ALREADY_EXISTS" },
    });
  });

  it("copies files with new ids and source-preserving content", () => {
    const state = createInitialVfsState();
    const copied = copyVfsNode(state, "/home/user/Documents/Welcome.md", "/home/user/Downloads", {
      now,
      newName: "Copied.txt",
    });

    expect(copied).toMatchObject({
      ok: true,
      value: {
        id: "vfs-node-0010",
        name: "Copied.txt",
        parentId: state.specialLocations.downloads,
        createdAt: now,
        modifiedAt: now,
      },
    });

    if (!copied.ok) {
      throw new Error("copy file failed");
    }

    const source = expectOk(readVfsTextFile(state, "/home/user/Documents/Welcome.md"));
    const target = expectOk(readVfsTextFile(copied.state, "/home/user/Downloads/Copied.txt"));

    expect(source.id).toBe("vfs-content-76cff3ce17d8a853403179f1");
    expect(target.id).toMatch(/^vfs-node-/);
    expect(target.id).not.toBe(source.id);
    expect(target.content).toEqual(source.content);
    expect(target.size).toBe(source.size);
    expect(copied.state.nextNodeSequence).toBe(state.nextNodeSequence + 1);
    expect(copied.state.revision).toBe(state.revision + 1);
    expect(validateVfsState(copied.state)).toEqual([]);
  });

  it("recursively copies directories with deterministic ids and child order", () => {
    const state = createProjectTree();
    const copied = expectMutation(copyVfsNode(state, "/home/user/Documents/Project", "/home/user/Downloads", { now: later }));
    const copiedRoot = copied.value as VfsDirectoryNode;

    expect(copiedRoot.id).toBe("vfs-node-0013");
    expect(copiedRoot.kind).toBe("directory");
    expect(copiedRoot.childIds).toEqual(["vfs-node-0014"]);
    expect((copied.state.nodesById["vfs-node-0014"] as VfsDirectoryNode).childIds).toEqual(["vfs-node-0015"]);
    expect(expectOk(readVfsTextFile(copied.state, "/home/user/Downloads/Project/Subfolder/Plan.txt"))).toMatchObject({
      id: "vfs-node-0015",
      content: { kind: "text", text: "中文" },
      size: 6,
      createdAt: later,
      modifiedAt: later,
    });
    expect(copied.state.nextNodeSequence).toBe(16);
    expect(copied.state.revision).toBe(state.revision + 1);
    expect(validateVfsState(copied.state)).toEqual([]);
  });

  it("rejects invalid copy cases without consuming ids", () => {
    const state = createProjectTree();
    const duplicate = copyVfsNode(state, "/home/user/Documents/Project", "/home/user/Documents", { now });
    const descendant = copyVfsNode(state, "/home/user/Documents/Project", "/home/user/Documents/Project/Subfolder", { now });
    const root = copyVfsNode(state, "/", "/home/user/Downloads", { now });
    const trash = copyVfsNode(state, "/home/user/.local/share/Trash/files", "/home/user/Downloads", { now });

    expect(duplicate).toMatchObject({ ok: false, state, error: { code: "ALREADY_EXISTS" } });
    expect(descendant).toMatchObject({ ok: false, state, error: { code: "INVALID_DESTINATION" } });
    expect(root).toMatchObject({ ok: false, state, error: { code: "ROOT_OPERATION_FORBIDDEN" } });
    expect(trash).toMatchObject({ ok: false, state, error: { code: "ROOT_OPERATION_FORBIDDEN" } });
    expect(state.nextNodeSequence).toBe(13);
  });
});

describe("VFS Trash mutations", () => {
  it("moves a file to Trash with metadata and generated conflict names", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Report.txt", "one", { now })).state;
    state = expectMutation(createVfsTextFile(state, "/home/user/Downloads", "Report.txt", "two", { now })).state;
    const first = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Report.txt", { now }));
    const second = expectMutation(moveVfsNodeToTrash(first.state, "/home/user/Downloads/Report.txt", { now: later }));
    const entries = expectOk(listVfsTrashEntries(second.state));

    expect(entries.map(({ node }) => node.name)).toEqual(["Report.txt", "Report (1).txt"]);
    expect(entries.map(({ entry }) => entry.originalName)).toEqual(["Report.txt", "Report.txt"]);
    expect(second.state.trashEntriesByNodeId[first.value.id]).toMatchObject({
      nodeId: first.value.id,
      originalParentId: state.specialLocations.documents,
      originalName: "Report.txt",
      trashedAt: now,
    });
    expect(validateVfsState(second.state)).toEqual([]);
  });

  it("moves a directory subtree to Trash without changing ids", () => {
    const state = createProjectTree();
    const trashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now }));

    expect(trashed.value).toMatchObject({ id: "vfs-node-0010", parentId: state.specialLocations.trash });
    expect(getVfsPathForNode(trashed.state, "vfs-node-0012")).toMatchObject({
      ok: true,
      value: "/home/user/.local/share/Trash/files/Project/Subfolder/Plan.txt",
    });
    expect(trashed.state.nextNodeSequence).toBe(state.nextNodeSequence);
    expect(trashed.state.revision).toBe(state.revision + 1);
    expect(validateVfsState(trashed.state)).toEqual([]);
  });

  it("rejects protected nodes and already trashed nodes", () => {
    const state = createProjectTree();
    const trashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now }));

    expect(moveVfsNodeToTrash(state, "/home/user/Documents", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" },
    });
    expect(moveVfsNodeToTrash(trashed.state, "/home/user/.local/share/Trash/files/Project", { now })).toMatchObject({
      ok: false,
      state: trashed.state,
      error: { code: "ALREADY_IN_TRASH" },
    });
  });

  it("restores Trash entries to their original parent and original name", () => {
    const state = createProjectTree();
    const trashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now }));
    const restored = restoreVfsNodeFromTrash(trashed.state, "vfs-node-0010", { now: later });

    expect(restored).toMatchObject({
      ok: true,
      value: { id: "vfs-node-0010", name: "Project", parentId: state.specialLocations.documents },
    });

    if (!restored.ok) {
      throw new Error("restore failed");
    }

    expect(getVfsPathForNode(restored.state, "vfs-node-0012")).toMatchObject({
      ok: true,
      value: "/home/user/Documents/Project/Subfolder/Plan.txt",
    });
    expect(restored.state.trashEntriesByNodeId["vfs-node-0010"]).toBeUndefined();
    expect(restored.state.revision).toBe(trashed.state.revision + 1);
    expect(validateVfsState(restored.state)).toEqual([]);
  });

  it("keeps metadata on restore collisions and unavailable original parents", () => {
    let state = createProjectTree();
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project/Subfolder/Plan.txt", { now })).state;
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project/Subfolder", "Plan.txt", "replacement", { now })).state;
    const conflict = restoreVfsNodeFromTrash(state, "vfs-node-0012", { now: later });

    expect(conflict).toMatchObject({ ok: false, state, error: { code: "ALREADY_EXISTS" } });
    expect(state.trashEntriesByNodeId["vfs-node-0012"]).toBeDefined();

    const parentTrashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now: later })).state;
    const unavailable = restoreVfsNodeFromTrash(parentTrashed, "vfs-node-0012", { now: later });
    const restoredParent = expectMutation(restoreVfsNodeFromTrash(parentTrashed, "vfs-node-0010", { now: later })).state;

    expect(unavailable).toMatchObject({ ok: false, state: parentTrashed, error: { code: "RESTORE_TARGET_UNAVAILABLE" } });
    expect(restoreVfsNodeFromTrash(restoredParent, "vfs-node-0012", { now: later })).toMatchObject({
      ok: false,
      error: { code: "ALREADY_EXISTS" },
    });
  });

  it("permanently deletes a top-level Trash entry and its complete subtree", () => {
    const state = createProjectTree();
    const trashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now }));
    const deleted = deleteVfsNodePermanently(trashed.state, "vfs-node-0010", { now: later });

    expect(deleted).toMatchObject({
      ok: true,
      value: { deletedNodeIds: ["vfs-node-0010", "vfs-node-0011", "vfs-node-0012"] },
    });

    if (!deleted.ok) {
      throw new Error("delete failed");
    }

    expect(deleted.state.nodesById["vfs-node-0010"]).toBeUndefined();
    expect(deleted.state.nodesById["vfs-node-0012"]).toBeUndefined();
    expect(deleted.state.trashEntriesByNodeId["vfs-node-0010"]).toBeUndefined();
    expect(deleted.state.nextNodeSequence).toBe(trashed.state.nextNodeSequence);
    expect(validateVfsState(deleted.state)).toEqual([]);
  });

  it("rejects permanent delete for non-Trash entries and Trash root", () => {
    const state = createInitialVfsState();

    expect(deleteVfsNodePermanently(state, "vfs-content-76cff3ce17d8a853403179f1", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "NOT_IN_TRASH" },
    });
    expect(deleteVfsNodePermanently(state, state.specialLocations.trash, { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" },
    });
  });

  it("empties Trash deterministically and treats empty Trash as no-op", () => {
    let state = createProjectTree();
    state = expectMutation(createVfsTextFile(state, "/home/user/Downloads", "Loose.txt", "x", { now })).state;
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now })).state;
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Downloads/Loose.txt", { now })).state;
    const emptied = emptyVfsTrash(state, { now: later });

    expect(emptied).toMatchObject({
      ok: true,
      value: { deletedNodeIds: ["vfs-node-0010", "vfs-node-0011", "vfs-node-0012", "vfs-node-0013"] },
    });

    if (!emptied.ok) {
      throw new Error("empty trash failed");
    }

    expect(expectOk(listVfsDirectory(emptied.state, "/home/user/.local/share/Trash/files"))).toEqual([]);
    expect(emptied.state.trashEntriesByNodeId).toEqual({});
    expect(emptied.state.revision).toBe(state.revision + 1);
    expect(emptyVfsTrash(emptied.state, { now })).toMatchObject({
      ok: true,
      state: emptied.state,
      value: { deletedNodeIds: [] },
    });
    expect(validateVfsState(emptied.state)).toEqual([]);
  });

  it("does not allow regular create move or copy to bypass Trash metadata", () => {
    const state = createInitialVfsState();
    const stateWithTrashSubtree = expectMutation(moveVfsNodeToTrash(createProjectTree(), "/home/user/Documents/Project", { now })).state;

    expect(createVfsDirectory(state, "/home/user/.local/share/Trash/files", "Manual", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(moveVfsNode(state, "/home/user/Documents/Welcome.md", "/home/user/.local/share/Trash/files", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(copyVfsNode(state, "/home/user/Documents/Welcome.md", "/home/user/.local/share/Trash/files", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(moveVfsNode(stateWithTrashSubtree, "/home/user/Documents/Welcome.md", "/home/user/.local/share/Trash/files/Project/Subfolder", { now })).toMatchObject({
      ok: false,
      state: stateWithTrashSubtree,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(copyVfsNode(stateWithTrashSubtree, "/home/user/Documents/Welcome.md", "/home/user/.local/share/Trash/files/Project/Subfolder", { now })).toMatchObject({
      ok: false,
      state: stateWithTrashSubtree,
      error: { code: "INVALID_DESTINATION" },
    });
  });
});
