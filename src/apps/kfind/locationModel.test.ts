import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, deleteVfsNodePermanently, moveVfsNode, moveVfsNodeToTrash, renameVfsNode } from "../../vfs/mutations";
import type { VfsState } from "../../vfs/types";
import { getKFindLocationPresentation, resolveKFindLocationInput } from "./locationModel";

const now = "2026-08-26T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed");
  return { state: result.state, value: result.value };
};

describe("KFind Look in location model", () => {
  it("accepts canonical VFS paths and file URLs, then presents normalized VFS-only file URLs", () => {
    const state = createInitialVfsState();

    expect(resolveKFindLocationInput(state, "/home/user/Documents")).toEqual({
      ok: true,
      value: { nodeId: state.specialLocations.documents, presentation: "file:///home/user/Documents" },
    });
    expect(resolveKFindLocationInput(state, "file:///home/user/Documents")).toEqual({
      ok: true,
      value: { nodeId: state.specialLocations.documents, presentation: "file:///home/user/Documents" },
    });
    expect(getKFindLocationPresentation(state, state.specialLocations.home)).toEqual({ ok: true, value: "file:///home/user" });
  });

  it("rejects invalid, host-style, missing, and file locations without a fallback directory", () => {
    const state = createInitialVfsState();

    expect(resolveKFindLocationInput(state, "file:///tmp")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resolveKFindLocationInput(state, "file://localhost/home/user")).toMatchObject({ ok: false, error: { code: "INVALID_PATH" } });
    expect(resolveKFindLocationInput(state, "/home/user/Documents/Notes.txt")).toMatchObject({ ok: false, error: { code: "NOT_DIRECTORY" } });
    expect(resolveKFindLocationInput(state, "")).toMatchObject({ ok: false, error: { code: "INVALID_PATH" } });
  });

  it("keeps a committed directory node identity valid across rename and move, then reports deletion", () => {
    const initial = createInitialVfsState();
    const created = expectMutation(createVfsDirectory(initial, "/home/user", "SearchRoot", { now }));
    const renamed = expectMutation(renameVfsNode(created.state, "/home/user/SearchRoot", "Papers", { now }));
    const moved = expectMutation(moveVfsNode(renamed.state, "/home/user/Papers", "/home/user/Downloads", { now }));
    const trashed = expectMutation(moveVfsNodeToTrash(moved.state, "/home/user/Downloads/Papers", { now }));
    const deleted = expectMutation(deleteVfsNodePermanently(trashed.state, created.value.id, { now }));

    expect(getKFindLocationPresentation(moved.state, created.value.id)).toEqual({ ok: true, value: "file:///home/user/Downloads/Papers" });
    expect(getKFindLocationPresentation(deleted.state, created.value.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});
