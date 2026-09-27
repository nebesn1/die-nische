import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { moveVfsNodeToTrash } from "../../vfs/mutations";
import { listVfsTrashEntries } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { deleteKonquerorTrashEntriesPermanently, restoreKonquerorTrashEntries } from "./trashActionController";

const now = "2026-08-03T00:00:00.000Z";
const environment = { now: () => now };
const mutationState = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) throw new Error("expected mutation");
  return result.state;
};
const makeStore = (initial: VfsState) => {
  let state = initial;
  return { get state() { return state; }, operations: createVfsOperations(() => state, (next) => { state = next; }) };
};

describe("Konqueror batch Trash action controller", () => {
  it("restores all selected entries, including entries with different original parents", () => {
    let state = mutationState(moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now }));
    state = mutationState(moveVfsNodeToTrash(state, "/home/user/Documents/Welcome.md", { now }));
    const store = makeStore(state);
    const result = restoreKonquerorTrashEntries(store.state, ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], store.operations, environment);

    expect(result).toMatchObject({ ok: true, restoredNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"] });
    expect(listVfsTrashEntries(store.state)).toMatchObject({ ok: true, value: [] });
  });

  it("does not restore a partial batch when one target has a restore collision", () => {
    let state = mutationState(moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now }));
    state = mutationState(moveVfsNodeToTrash(state, "/home/user/Documents/Welcome.md", { now }));
    const store = makeStore(state);
    const revision = store.state.revision;
    const result = restoreKonquerorTrashEntries(store.state, ["vfs-content-e594a065214576326cb903a5", "missing"], store.operations, environment);

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_IN_TRASH" } });
    expect(store.state.revision).toBe(revision);
  });

  it("permanently deletes one confirmed snapshot batch", () => {
    let state = mutationState(moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now }));
    state = mutationState(moveVfsNodeToTrash(state, "/home/user/Documents/Welcome.md", { now }));
    const store = makeStore(state);
    const result = deleteKonquerorTrashEntriesPermanently(store.state, {
      kind: "delete-permanently", targetNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], targetLabel: "2 selected items", error: null,
    }, { kind: "empty" }, store.operations, environment);

    expect(result).toMatchObject({ ok: true, deletedNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], shouldClearClipboard: false });
    expect(listVfsTrashEntries(store.state)).toMatchObject({ ok: true, value: [] });
  });
});
