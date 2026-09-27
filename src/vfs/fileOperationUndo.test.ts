import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { createVfsFileOperationUndoEntry, undoVfsFileOperation } from "./fileOperationUndo";
import { copyVfsNode, createVfsDirectory, moveVfsNode, moveVfsNodeToTrash, writeVfsTextFile } from "./mutations";
import { getVfsPathForNode } from "./queries";
import type { VfsState } from "./types";

const now = "2026-09-05T00:00:00.000Z";
const later = "2026-09-05T00:01:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed");
  return result;
};

const expectEntry = (result: ReturnType<typeof createVfsFileOperationUndoEntry>) => {
  if (!result.ok || result.value === null) throw new Error("Expected undo entry");
  return result.value;
};

describe("VFS file-operation undo", () => {
  it("removes a created root by stable ID without restoring a whole VFS snapshot", () => {
    const before = createInitialVfsState();
    const created = expectMutation(createVfsDirectory(before, "/home/user/Documents", "Undo Folder", { now }));
    const entry = expectEntry(createVfsFileOperationUndoEntry("create", before, created.state, [created.value.id]));
    const undone = undoVfsFileOperation(created.state, entry, { now: later });

    expect(undone).toMatchObject({ ok: true });
    if (undone.ok) {
      expect(undone.state.nodesById[created.value.id]).toBeUndefined();
      expect(getVfsPathForNode(undone.state, before.specialLocations.documents)).toMatchObject({ ok: true, value: "/home/user/Documents" });
    }
  });

  it("refuses destructive copy undo when the copied subtree has changed and leaves the VFS untouched", () => {
    const before = createInitialVfsState();
    const copied = expectMutation(copyVfsNode(before, "/home/user/Documents/Welcome.md", "/home/user/Downloads", { now }));
    const entry = expectEntry(createVfsFileOperationUndoEntry("copy", before, copied.state, [copied.value.id]));
    const changed = expectMutation(writeVfsTextFile(copied.state, "/home/user/Downloads/Welcome.md", "changed", { now: later }));
    const undone = undoVfsFileOperation(changed.state, entry, { now: later });

    expect(undone).toMatchObject({ ok: false, state: changed.state });
    expect(changed.state.nodesById[copied.value.id]).toMatchObject({ name: "Welcome.md", content: { kind: "text", text: "changed" } });
  });

  it("rejects a changed root in a created batch without partially deleting its untouched sibling", () => {
    const initial = createInitialVfsState();
    const first = expectMutation(createVfsDirectory(initial, "/home/user/Documents", "First", { now }));
    const second = expectMutation(createVfsDirectory(first.state, "/home/user/Documents", "Second", { now }));
    const entry = expectEntry(createVfsFileOperationUndoEntry("create", initial, second.state, [first.value.id, second.value.id]));
    const changed = expectMutation(createVfsDirectory(second.state, "/home/user/Documents/Second", "Child", { now: later }));
    const undone = undoVfsFileOperation(changed.state, entry, { now: later });

    expect(undone).toMatchObject({ ok: false, state: changed.state });
    expect(changed.state.nodesById[first.value.id]).toBeDefined();
    expect(changed.state.nodesById[second.value.id]).toBeDefined();
  });

  it("returns moved nodes to their exact original parent while retaining node identity", () => {
    const before = createInitialVfsState();
    const moved = expectMutation(moveVfsNode(before, "/home/user/Documents/Notes.txt", "/home/user/Downloads", { now }));
    const entry = expectEntry(createVfsFileOperationUndoEntry("move", before, moved.state, [moved.value.id]));
    const undone = undoVfsFileOperation(moved.state, entry, { now: later });

    expect(undone).toMatchObject({ ok: true });
    if (undone.ok) {
      expect(undone.state.nodesById[moved.value.id]).toMatchObject({ id: moved.value.id, parentId: before.specialLocations.documents, name: "Notes.txt" });
    }
  });

  it("refuses a move undo when a later collision occupies the original name", () => {
    const before = createInitialVfsState();
    const moved = expectMutation(moveVfsNode(before, "/home/user/Documents/Notes.txt", "/home/user/Downloads", { now }));
    const entry = expectEntry(createVfsFileOperationUndoEntry("move", before, moved.state, [moved.value.id]));
    const replacement = expectMutation(copyVfsNode(moved.state, "/home/user/Documents/Welcome.md", "/home/user/Documents", { now: later, newName: "Notes.txt" }));
    const undone = undoVfsFileOperation(replacement.state, entry, { now: later });

    expect(undone).toMatchObject({ ok: false, state: replacement.state });
    expect(replacement.state.nodesById[moved.value.id]).toMatchObject({ parentId: before.specialLocations.downloads });
  });

  it("restores a trashed batch using recorded trash metadata", () => {
    const before = createInitialVfsState();
    const trashed = expectMutation(moveVfsNodeToTrash(before, "/home/user/Documents/Notes.txt", { now }));
    const entry = expectEntry(createVfsFileOperationUndoEntry("trash", before, trashed.state, [trashed.value.id]));
    const undone = undoVfsFileOperation(trashed.state, entry, { now: later });

    expect(undone).toMatchObject({ ok: true });
    if (undone.ok) {
      expect(undone.state.nodesById[trashed.value.id]).toMatchObject({ parentId: before.specialLocations.documents, name: "Notes.txt" });
      expect(undone.state.trashEntriesByNodeId[trashed.value.id]).toBeUndefined();
    }
  });
});
