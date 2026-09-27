import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { createVfsDirectory, moveVfsNodeToTrash } from "./mutations";
import { getVfsPathForNode } from "./queries";
import {
  getKonquerorTrashLocation,
  getVfsTrashRelativePath,
  isVfsNodeInsideTrash,
  isVfsTrashRoot,
  KONQUEROR_TRASH_LOCATION,
  VFS_TRASH_FILES_PATH,
} from "./trashPaths";
import type { VfsState } from "./types";

const now = "2026-08-21T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { readonly state: VfsState; readonly value: T } => {
  if (!result.ok) {
    throw new Error("fixture mutation failed");
  }

  return result;
};

describe("Trash path presentation", () => {
  it("uses one canonical VFS backend and a separate Konqueror protocol label", () => {
    const state = createInitialVfsState();

    expect(VFS_TRASH_FILES_PATH).toBe("/home/user/.local/share/Trash/files");
    expect(KONQUEROR_TRASH_LOCATION).toBe("trash:/");
    expect(getVfsPathForNode(state, state.specialLocations.trash)).toMatchObject({
      ok: true,
      value: VFS_TRASH_FILES_PATH,
    });
    expect(getKonquerorTrashLocation(state, state.specialLocations.trash)).toBe("trash:/");
    expect(isVfsTrashRoot(state, state.specialLocations.trash)).toBe(true);
  });

  it("derives nested protocol paths from current stable node ancestry", () => {
    let state = createInitialVfsState();
    const created = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Old Folder", { now }));
    state = created.state;
    const nested = expectMutation(createVfsDirectory(state, "/home/user/Documents/Old Folder", "Sub", { now }));
    const trashed = expectMutation(moveVfsNodeToTrash(nested.state, "/home/user/Documents/Old Folder", { now }));

    expect(getKonquerorTrashLocation(trashed.state, created.value.id)).toBe("trash:/Old Folder");
    expect(getKonquerorTrashLocation(trashed.state, nested.value.id)).toBe("trash:/Old Folder/Sub");
    expect(getVfsTrashRelativePath(trashed.state, nested.value.id)).toBe("Old Folder/Sub");
    expect(isVfsNodeInsideTrash(trashed.state, nested.value.id)).toBe(true);
  });

  it("preserves literal VFS names in protocol presentation without URL decoding", () => {
    const state = createInitialVfsState();
    const created = expectMutation(createVfsDirectory(state, "/home/user/Documents", "机器人 #?%", { now }));
    const trashed = expectMutation(moveVfsNodeToTrash(created.state, "/home/user/Documents/机器人 #?%", { now }));

    expect(getKonquerorTrashLocation(trashed.state, created.value.id)).toBe("trash:/机器人 #?%");
  });

  it("does not identify ordinary directories as Trash by their path strings", () => {
    const state = createInitialVfsState();

    expect(isVfsNodeInsideTrash(state, state.specialLocations.documents)).toBe(false);
    expect(getVfsTrashRelativePath(state, state.specialLocations.documents)).toBeNull();
    expect(getKonquerorTrashLocation(state, state.specialLocations.documents)).toBeNull();
  });
});
