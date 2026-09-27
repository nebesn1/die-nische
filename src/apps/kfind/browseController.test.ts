import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, deleteVfsNodePermanently, moveVfsNodeToTrash, renameVfsNode } from "../../vfs/mutations";
import { getVfsPathForNode } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { selectKFindBrowseDirectory } from "./browseController";

const now = "2026-08-11T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed");
  return { state: result.state, value: result.value };
};

describe("KFind Browse selection", () => {
  it("selects the currently browsed directory when no child folder is selected", () => {
    const state = createInitialVfsState();

    expect(selectKFindBrowseDirectory(state, state.specialLocations.home)).toEqual({ ok: true, value: state.specialLocations.home });
    expect(selectKFindBrowseDirectory(state, state.specialLocations.documents)).toEqual({ ok: true, value: state.specialLocations.documents });
  });

  it("selects a single-clicked child directory directly without requiring navigation", () => {
    const state = createInitialVfsState();

    expect(selectKFindBrowseDirectory(state, state.specialLocations.home, state.specialLocations.documents)).toEqual({
      ok: true,
      value: state.specialLocations.documents,
    });
  });

  it("retains the stable current directory id through rename and derives its latest path", () => {
    const state = createInitialVfsState();
    const renamed = expectMutation(renameVfsNode(state, "/home/user/Documents", "Papers", { now }));

    expect(selectKFindBrowseDirectory(renamed.state, state.specialLocations.documents)).toEqual({ ok: true, value: state.specialLocations.documents });
    expect(getVfsPathForNode(renamed.state, state.specialLocations.documents)).toEqual({ ok: true, value: "/home/user/Papers" });
  });

  it("rejects unavailable and non-directory current locations without a stale fallback", () => {
    const created = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "test", { now }));
    const trashed = expectMutation(moveVfsNodeToTrash(created.state, "/home/user/Documents/test", { now }));
    const deleted = expectMutation(deleteVfsNodePermanently(trashed.state, created.value.id, { now }));

    expect(selectKFindBrowseDirectory(deleted.state, created.value.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(selectKFindBrowseDirectory(created.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: false, error: { code: "NOT_DIRECTORY" } });
  });

  it("does not fall back to the current directory when a selected folder disappears", () => {
    const created = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "test", { now }));
    const trashed = expectMutation(moveVfsNodeToTrash(created.state, "/home/user/Documents/test", { now }));
    const deleted = expectMutation(deleteVfsNodePermanently(trashed.state, created.value.id, { now }));

    expect(selectKFindBrowseDirectory(deleted.state, deleted.state.specialLocations.home, created.value.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});
