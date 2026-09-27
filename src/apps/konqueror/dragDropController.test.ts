import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { getVfsPathForNode, listVfsDirectory } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import {
  buildKonquerorDragOperationPlan,
  canKonquerorAcceptFileDrop,
  executeKonquerorDropAction,
  type KonquerorDragOperationPlan,
  type KonquerorDropActionRequest,
} from "./dragDropController";

const environment = { now: () => "2026-09-01T00:00:00.000Z" };
const makeStore = (initial: VfsState) => {
  let state = initial;
  return {
    get state() { return state; },
    operations: createVfsOperations(() => state, (next) => { state = next; }),
  };
};

const requestFromPlan = (plan: KonquerorDragOperationPlan, targetFolderNodeId: string): KonquerorDropActionRequest => ({
  ...plan,
  requestId: 1,
  ownerWindowId: "test-window",
  targetWindowId: "test-window",
  targetFolderNodeId,
  clientX: 100,
  clientY: 100,
});

describe("Konqueror direct drag/drop controller", () => {
  it("accepts only ordinary writable directories as file-drop targets", () => {
    const state = createInitialVfsState();
    expect(canKonquerorAcceptFileDrop(state, state.specialLocations.downloads)).toBe(true);
    expect(canKonquerorAcceptFileDrop(state, "vfs-content-e594a065214576326cb903a5")).toBe(false);
    expect(canKonquerorAcceptFileDrop(state, state.specialLocations.trash)).toBe(false);
  });

  it("freezes visible raw drag order while normalizing ancestor-covered roots", () => {
    const a = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now: environment.now() });
    if (!a.ok) throw new Error("A fixture failed");
    const child = createVfsTextFile(a.state, "/home/user/Documents/A", "Child.txt", "child", { now: environment.now() });
    if (!child.ok) throw new Error("Child fixture failed");
    const plan = buildKonquerorDragOperationPlan(child.state, [a.value.id, child.value.id, "vfs-content-e594a065214576326cb903a5"]);

    expect(plan).toMatchObject({
      ok: true,
      value: { rawDraggedNodeIds: [a.value.id, child.value.id, "vfs-content-e594a065214576326cb903a5"], operationRootNodeIds: [a.value.id, "vfs-content-e594a065214576326cb903a5"] },
    });
  });

  it("moves normalized multi-parent roots directly without changing clipboard state", () => {
    const picture = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", { now: environment.now() });
    if (!picture.ok) throw new Error("Picture fixture failed");
    const store = makeStore(picture.state);
    const plan = buildKonquerorDragOperationPlan(store.state, ["vfs-content-e594a065214576326cb903a5", picture.value.id]);
    if (!plan.ok) throw new Error("Drag plan failed");

    const result = executeKonquerorDropAction(store.state, requestFromPlan(plan.value, store.state.specialLocations.downloads), "move", store.operations, environment);
    expect(result).toMatchObject({ ok: true });
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Downloads/Notes.txt" });
    expect(getVfsPathForNode(store.state, picture.value.id)).toMatchObject({ ok: true, value: "/home/user/Downloads/Photo.txt" });
  });

  it("copies a folder subtree once and rejects stale/collision batches atomically", () => {
    const a = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now: environment.now() });
    if (!a.ok) throw new Error("A fixture failed");
    const child = createVfsTextFile(a.state, "/home/user/Documents/A", "Child.txt", "child", { now: environment.now() });
    if (!child.ok) throw new Error("Child fixture failed");
    const store = makeStore(child.state);
    const plan = buildKonquerorDragOperationPlan(store.state, [a.value.id, child.value.id]);
    if (!plan.ok) throw new Error("Drag plan failed");
    const copied = executeKonquerorDropAction(store.state, requestFromPlan(plan.value, store.state.specialLocations.downloads), "copy", store.operations, environment);
    expect(copied).toMatchObject({ ok: true });
    expect(listVfsDirectory(store.state, "/home/user/Downloads/A")).toMatchObject({ ok: true, value: [expect.objectContaining({ name: "Child.txt" })] });

    const revision = store.state.revision;
    const collision = executeKonquerorDropAction(store.state, requestFromPlan(plan.value, store.state.specialLocations.downloads), "copy", store.operations, environment);
    expect(collision).toMatchObject({ ok: false, error: { code: "ALREADY_EXISTS" } });
    expect(store.state.revision).toBe(revision);

    const stale = executeKonquerorDropAction(store.state, { ...requestFromPlan(plan.value, store.state.specialLocations.music), sourceParentIdsByNodeId: { [a.value.id]: "missing-parent" } }, "copy", store.operations, environment);
    expect(stale).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("uses the frozen target NodeId after a target move and rejects a target that becomes read-only", () => {
    const target = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Target", { now: environment.now() });
    if (!target.ok) throw new Error("Target fixture failed");
    const store = makeStore(target.state);
    const plan = buildKonquerorDragOperationPlan(store.state, ["vfs-content-e594a065214576326cb903a5"]);
    if (!plan.ok) throw new Error("Drag plan failed");
    const request = requestFromPlan(plan.value, target.value.id);

    expect(store.operations.moveNode("/home/user/Documents/Target", "/home/user/Downloads", { now: environment.now() })).toMatchObject({ ok: true });
    expect(executeKonquerorDropAction(store.state, request, "copy", store.operations, environment)).toMatchObject({ ok: true });
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
    expect(listVfsDirectory(store.state, "/home/user/Downloads/Target")).toMatchObject({ ok: true, value: [expect.objectContaining({ name: "Notes.txt" })] });

    expect(store.operations.moveNodeToTrash("/home/user/Downloads/Target", { now: environment.now() })).toMatchObject({ ok: true });
    const revision = store.state.revision;
    expect(executeKonquerorDropAction(store.state, request, "copy", store.operations, environment)).toMatchObject({ ok: false, error: { code: "INVALID_DESTINATION" } });
    expect(store.state.revision).toBe(revision);
  });

  it("uses raw visible targets for Link Here while Move and Copy retain recursive roots", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now: environment.now() });
    if (!folder.ok) throw new Error("Folder fixture failed");
    const child = createVfsTextFile(folder.state, "/home/user/Documents/A", "Child.txt", "child", { now: environment.now() });
    if (!child.ok) throw new Error("Child fixture failed");
    const store = makeStore(child.state);
    const plan = buildKonquerorDragOperationPlan(store.state, [folder.value.id, child.value.id, "vfs-content-e594a065214576326cb903a5"]);
    if (!plan.ok) throw new Error("Drag plan failed");

    expect(plan.value.operationRootNodeIds).toEqual([folder.value.id, "vfs-content-e594a065214576326cb903a5"]);
    expect(executeKonquerorDropAction(store.state, requestFromPlan(plan.value, store.state.specialLocations.downloads), "link", store.operations, environment)).toMatchObject({ ok: true });
    expect(listVfsDirectory(store.state, "/home/user/Downloads")).toMatchObject({
      ok: true,
      value: [
        expect.objectContaining({ kind: "link", targetNodeId: folder.value.id }),
        expect.objectContaining({ kind: "link", targetNodeId: child.value.id }),
        expect.objectContaining({ kind: "link", targetNodeId: "vfs-content-e594a065214576326cb903a5" }),
      ],
    });
  });
});
