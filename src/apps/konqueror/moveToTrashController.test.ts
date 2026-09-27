import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { listVfsDirectory, listVfsTrashEntries } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { submitKonquerorMoveToTrash } from "./moveToTrashController";
import { normalizeKonquerorRecursiveOperationTargets } from "./recursiveOperationTargets";

const now = "2026-08-03T00:00:00.000Z";
const environment = { now: () => now };
const makeStore = (initial: VfsState) => {
  let state = initial;
  return { get state() { return state; }, operations: createVfsOperations(() => state, (next) => { state = next; }) };
};

describe("Konqueror batch Move to Trash controller", () => {
  it("moves every confirmed target to Trash atomically", () => {
    const store = makeStore(createInitialVfsState());
    const result = submitKonquerorMoveToTrash(store.state, {
      kind: "move-to-trash", targetNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], targetLabel: "2 selected items", error: null,
    }, { kind: "empty" }, store.operations, environment);

    expect(result).toMatchObject({ ok: true, trashedNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], shouldClearClipboard: false });
    expect(listVfsDirectory(store.state, "/home/user/Documents")).toMatchObject({
      ok: true,
      value: expect.not.arrayContaining([
        expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }),
        expect.objectContaining({ id: "vfs-content-76cff3ce17d8a853403179f1" }),
      ]),
    });
    expect(listVfsTrashEntries(store.state)).toMatchObject({ ok: true, value: expect.arrayContaining([
      expect.objectContaining({ node: expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }) }),
      expect.objectContaining({ node: expect.objectContaining({ id: "vfs-content-76cff3ce17d8a853403179f1" }) }),
    ]) });
  });

  it("rejects the full batch when any target is ineligible", () => {
    const store = makeStore(createInitialVfsState());
    const revision = store.state.revision;
    const result = submitKonquerorMoveToTrash(store.state, {
      kind: "move-to-trash", targetNodeIds: ["vfs-content-e594a065214576326cb903a5", store.state.specialLocations.documents], operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5", store.state.specialLocations.documents], targetLabel: "2 selected items", error: null,
    }, { kind: "empty" }, store.operations, environment);

    expect(result).toMatchObject({ ok: false, error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" } });
    expect(store.state.revision).toBe(revision);
  });

  it("moves selected ancestor subtrees once while preserving the raw confirmation snapshot", () => {
    const a = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now });
    if (!a.ok) throw new Error("A fixture failed");
    const b = createVfsDirectory(a.state, "/home/user/Documents/A", "B", { now });
    if (!b.ok) throw new Error("B fixture failed");
    const bFile = createVfsTextFile(b.state, "/home/user/Documents/A/B", "B.txt", "b", { now });
    if (!bFile.ok) throw new Error("B.txt fixture failed");
    const aFile = createVfsTextFile(bFile.state, "/home/user/Documents/A", "A.txt", "a", { now });
    if (!aFile.ok) throw new Error("A.txt fixture failed");
    const abFile = createVfsTextFile(aFile.state, "/home/user/Documents/A", "AB.txt", "ab", { now });
    if (!abFile.ok) throw new Error("AB.txt fixture failed");

    const rawTargetNodeIds = [a.value.id, b.value.id, bFile.value.id, aFile.value.id, abFile.value.id];
    const roots = normalizeKonquerorRecursiveOperationTargets(abFile.state, rawTargetNodeIds);
    if (!roots.ok) throw new Error("Normalization failed");
    expect(roots.value).toEqual([a.value.id]);

    const store = makeStore(abFile.state);
    const result = submitKonquerorMoveToTrash(store.state, {
      kind: "move-to-trash",
      targetNodeIds: rawTargetNodeIds,
      operationRootNodeIds: roots.value,
      targetLabel: "5 selected items",
      error: null,
    }, { kind: "empty" }, store.operations, environment);

    expect(result).toMatchObject({ ok: true, trashedNodeIds: [a.value.id], statusMessage: "Moved 5 items to the Trash" });
    expect(listVfsDirectory(store.state, "/home/user/Documents")).toMatchObject({
      ok: true,
      value: expect.not.arrayContaining([expect.objectContaining({ id: a.value.id })]),
    });
    const trash = listVfsTrashEntries(store.state);
    expect(trash).toMatchObject({ ok: true });
    if (!trash.ok) throw new Error("Trash listing failed");
    expect(trash.value.map((entry) => entry.node.id)).toContain(a.value.id);
    expect(trash.value.map((entry) => entry.node.id)).not.toEqual(expect.arrayContaining([
      b.value.id,
      bFile.value.id,
      aFile.value.id,
      abFile.value.id,
    ]));
  });

  it("keeps independent cross-parent roots in the same atomic Move to Trash batch", () => {
    const a = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now });
    if (!a.ok) throw new Error("A fixture failed");
    const aFile = createVfsTextFile(a.state, "/home/user/Documents/A", "A.txt", "a", { now });
    if (!aFile.ok) throw new Error("A.txt fixture failed");
    const picture = createVfsTextFile(aFile.state, "/home/user/Pictures", "C.txt", "c", { now });
    if (!picture.ok) throw new Error("C.txt fixture failed");

    const rawTargetNodeIds = [a.value.id, aFile.value.id, picture.value.id];
    const roots = normalizeKonquerorRecursiveOperationTargets(picture.state, rawTargetNodeIds);
    if (!roots.ok) throw new Error("Normalization failed");
    expect(roots.value).toEqual([a.value.id, picture.value.id]);

    const store = makeStore(picture.state);
    const result = submitKonquerorMoveToTrash(store.state, {
      kind: "move-to-trash",
      targetNodeIds: rawTargetNodeIds,
      operationRootNodeIds: roots.value,
      targetLabel: "3 selected items",
      error: null,
    }, { kind: "empty" }, store.operations, environment);

    expect(result).toMatchObject({ ok: true, trashedNodeIds: [a.value.id, picture.value.id] });
    const trash = listVfsTrashEntries(store.state);
    expect(trash).toMatchObject({ ok: true });
    if (!trash.ok) throw new Error("Trash listing failed");
    expect(trash.value.map((entry) => entry.node.id)).toEqual(expect.arrayContaining([a.value.id, picture.value.id]));
  });

  it("keeps a true stale operation root as an atomic, operation-level failure", () => {
    const store = makeStore(createInitialVfsState());
    const revision = store.state.revision;
    const result = submitKonquerorMoveToTrash(store.state, {
      kind: "move-to-trash",
      targetNodeIds: ["missing-node"],
      operationRootNodeIds: ["missing-node"],
      targetLabel: "Missing.txt",
      error: null,
    }, { kind: "empty" }, store.operations, environment);

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(store.state.revision).toBe(revision);
  });
});
