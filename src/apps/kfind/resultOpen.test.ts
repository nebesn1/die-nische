import { describe, expect, it } from "vitest";
import { deleteVfsNodePermanently, moveVfsNode, moveVfsNodeToTrash, renameVfsNode } from "../../vfs/mutations";
import { createInitialVfsState } from "../../vfs/initialState";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";
import type { VfsMutationResult, VfsResult } from "../../vfs/result";
import type { VfsState } from "../../vfs/types";
import { planKFindResultOpen } from "./resultOpen";

const now = "2026-08-26T00:00:00.000Z";

const expectOk = <T,>(result: VfsResult<T>): T => {
  if (!result.ok) {
    throw new Error("Expected VFS fixture operation to succeed");
  }

  return result.value;
};

const expectMutationOk = <T,>(
  result: VfsMutationResult<T>,
): { readonly ok: true; readonly state: VfsState; readonly value: T } => {
  if (!result.ok) {
    throw new Error("Expected VFS fixture mutation to succeed");
  }

  return result;
};

describe("KFind result opening", () => {
  it("plans a directory result as a Konqueror new-window directory intent", () => {
    const state = createInitialVfsState();
    const planned = planKFindResultOpen(state, state.specialLocations.documents);

    expect(planned).toEqual({
      ok: true,
      value: {
        appId: "konqueror",
        intent: { type: "open-directory", nodeId: state.specialLocations.documents },
      },
    });
  });

  it("plans every file result as a Konqueror file intent without choosing a previewer", () => {
    const state = createInitialVfsState();
    const notes = expectOk(resolveVfsPath(state, "/home/user/Documents/Notes.txt"));
    const planned = planKFindResultOpen(state, notes.id);

    expect(planned).toEqual({
      ok: true,
      value: {
        appId: "konqueror",
        intent: { type: "open-file", nodeId: notes.id },
      },
    });
    expect(planned.ok && "previewerId" in planned.value.intent).toBe(false);
  });

  it("keeps the stable result id authoritative across rename and move", () => {
    const initial = createInitialVfsState();
    const notes = expectOk(resolveVfsPath(initial, "/home/user/Documents/Notes.txt"));
    const renamed = renameVfsNode(initial, "/home/user/Documents/Notes.txt", "Journal.md", { now });
    const moved = moveVfsNode(expectMutationOk(renamed).state, "/home/user/Documents/Journal.md", "/home/user/Downloads", { now });

    const state = expectMutationOk(moved).state;
    const planned = planKFindResultOpen(state, notes.id);

    expect(planned).toEqual({
      ok: true,
      value: { appId: "konqueror", intent: { type: "open-file", nodeId: notes.id } },
    });
    expect(getVfsPathForNode(state, notes.id)).toEqual({ ok: true, value: "/home/user/Downloads/Journal.md" });
  });

  it("rejects a permanently deleted saved result without producing a launch plan", () => {
    const initial = createInitialVfsState();
    const notes = expectOk(resolveVfsPath(initial, "/home/user/Documents/Notes.txt"));
    const trashed = moveVfsNodeToTrash(initial, "/home/user/Documents/Notes.txt", { now });
    const deleted = deleteVfsNodePermanently(expectMutationOk(trashed).state, notes.id, { now });

    expect(planKFindResultOpen(expectMutationOk(deleted).state, notes.id)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", nodeId: notes.id },
    });
  });
});
