import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { createVfsDirectory, deleteVfsNodePermanently, moveVfsNodeToTrash } from "./mutations";
import { enterVfsDialogDirectory, resolveVfsDialogTargetDirectory, selectVfsDialogDirectory } from "./vfsDialogController";
import type { VfsState } from "./types";

const now = "2026-08-26T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed");
  return { state: result.state, value: result.value };
};

describe("VFS dialog target directory resolution", () => {
  it("keeps single-click selection separate from double-click navigation", () => {
    expect(selectVfsDialogDirectory("vfs-user", "vfs-documents")).toEqual({
      currentDirectoryNodeId: "vfs-user",
      selectedDirectoryNodeId: "vfs-documents",
    });
    expect(enterVfsDialogDirectory("vfs-documents")).toEqual({
      currentDirectoryNodeId: "vfs-documents",
      selectedDirectoryNodeId: null,
    });
  });

  it("uses the selected directory without changing the currently browsed directory", () => {
    const state = createInitialVfsState();

    expect(resolveVfsDialogTargetDirectory(state, state.specialLocations.home, state.specialLocations.documents)).toEqual({
      ok: true,
      value: state.specialLocations.documents,
    });
    expect(resolveVfsDialogTargetDirectory(state, state.specialLocations.home, null)).toEqual({
      ok: true,
      value: state.specialLocations.home,
    });
  });

  it("keeps selected directory identity valid through rename and move", () => {
    const created = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Selected", { now }));
    const moved = expectMutation(moveVfsNodeToTrash(created.state, "/home/user/Documents/Selected", { now }));

    expect(resolveVfsDialogTargetDirectory(moved.state, moved.state.specialLocations.home, created.value.id)).toEqual({
      ok: true,
      value: created.value.id,
    });
  });

  it("does not silently fall back to the current directory when the selected directory is deleted", () => {
    const created = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Selected", { now }));
    const trashed = expectMutation(moveVfsNodeToTrash(created.state, "/home/user/Documents/Selected", { now }));
    const deleted = expectMutation(deleteVfsNodePermanently(trashed.state, created.value.id, { now }));

    expect(resolveVfsDialogTargetDirectory(deleted.state, deleted.state.specialLocations.home, created.value.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("rejects a file when it is supplied as a directory target", () => {
    const state = createInitialVfsState();

    expect(resolveVfsDialogTargetDirectory(state, state.specialLocations.home, "vfs-content-e594a065214576326cb903a5")).toMatchObject({
      ok: false,
      error: { code: "NOT_DIRECTORY" },
    });
  });
});
