import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { getVfsPathForNode, listVfsDirectory } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import {
  createKonquerorDirectTransferRequest,
  getKonquerorDirectTransferAvailability,
  resolveKonquerorDirectTransferDestination,
  submitKonquerorDirectTransfer,
} from "./directTransferController";

const environment = { now: () => "2026-09-05T00:00:00.000Z" };
const makeStore = (initial: VfsState) => {
  let state = initial;
  return {
    get state() { return state; },
    operations: createVfsOperations(() => state, (next) => { state = next; }),
  };
};

describe("Konqueror direct copy/move destination controller", () => {
  it("enables only transferable filesystem selections", () => {
    const state = createInitialVfsState();

    expect(getKonquerorDirectTransferAvailability(state, [], false)).toMatchObject({ canTransfer: false });
    expect(getKonquerorDirectTransferAvailability(state, ["vfs-content-e594a065214576326cb903a5"], false)).toMatchObject({ canTransfer: true });
    expect(getKonquerorDirectTransferAvailability(state, [state.specialLocations.trash], false)).toMatchObject({ canTransfer: false });
    expect(getKonquerorDirectTransferAvailability(state, ["vfs-content-e594a065214576326cb903a5"], true)).toMatchObject({ canTransfer: false });
  });

  it("requires an existing absolute ordinary VFS directory and preserves paths with spaces", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user", "My Folder", { now: environment.now() });
    if (!folder.ok) throw new Error("Fixture failed");

    expect(resolveKonquerorDirectTransferDestination(folder.state, "/home/user/My Folder")).toMatchObject({
      ok: true,
      value: { nodeId: folder.value.id, path: "/home/user/My Folder" },
    });
    for (const path of ["Documents", "file:///home/user/Documents", "/home/user/Documents/Welcome.md", "/home/user/Missing", "trash:/"]) {
      expect(resolveKonquerorDirectTransferDestination(folder.state, path)).toMatchObject({ ok: false });
    }
  });

  it("copies frozen multi-selection roots without changing source identity", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now: environment.now() });
    if (!folder.ok) throw new Error("Fixture failed");
    const child = createVfsTextFile(folder.state, "/home/user/Documents/A", "Child.txt", "child", { now: environment.now() });
    if (!child.ok) throw new Error("Fixture failed");
    const store = makeStore(child.state);
    const request = createKonquerorDirectTransferRequest(
      store.state,
      "copy",
      "konqueror-a",
      store.state.specialLocations.documents,
      [folder.value.id, child.value.id, "vfs-content-e594a065214576326cb903a5"],
    );
    if (!request.ok) throw new Error("Request failed");

    const result = submitKonquerorDirectTransfer(store.state, request.value, "/home/user/Downloads", store.operations, environment);
    expect(result).toMatchObject({ ok: true });
    expect(listVfsDirectory(store.state, "/home/user/Downloads/A")).toMatchObject({
      ok: true,
      value: [expect.objectContaining({ name: "Child.txt" })],
    });
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
  });

  it("marks a background request as a current-directory source while reusing the same transfer plan", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now: environment.now() });
    if (!folder.ok) throw new Error("Fixture failed");

    const request = createKonquerorDirectTransferRequest(
      folder.state,
      "copy",
      "konqueror-a",
      folder.value.id,
      [folder.value.id],
      "current-directory",
    );

    expect(request).toMatchObject({
      ok: true,
      value: {
        sourceKind: "current-directory",
        sourceLocationNodeId: folder.value.id,
        rawDraggedNodeIds: [folder.value.id],
        operationRootNodeIds: [folder.value.id],
      },
    });
  });

  it("marks a file-preview request as a current-file source while preserving the typed file ID", () => {
    const file = createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "Current.txt", "current", { now: environment.now() });
    if (!file.ok) throw new Error("Fixture failed");
    if (file.value.parentId === null) throw new Error("File parent fixture missing");

    const request = createKonquerorDirectTransferRequest(
      file.state,
      "move",
      "konqueror-a",
      file.value.parentId,
      [file.value.id],
      "current-file",
    );

    expect(request).toMatchObject({
      ok: true,
      value: {
        sourceKind: "current-file",
        sourceLocationNodeId: file.value.parentId,
        rawDraggedNodeIds: [file.value.id],
        operationRootNodeIds: [file.value.id],
      },
    });
  });

  it("marks an item-menu request as a context-item source while preserving the clicked stable ID", () => {
    const file = createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "Clicked.txt", "clicked", { now: environment.now() });
    if (!file.ok) throw new Error("Fixture failed");
    if (file.value.parentId === null) throw new Error("File parent fixture missing");

    const request = createKonquerorDirectTransferRequest(
      file.state,
      "copy",
      "konqueror-a",
      file.value.parentId,
      [file.value.id],
      "context-item",
    );

    expect(request).toMatchObject({
      ok: true,
      value: {
        sourceKind: "context-item",
        sourceLocationNodeId: file.value.parentId,
        rawDraggedNodeIds: [file.value.id],
        operationRootNodeIds: [file.value.id],
      },
    });
  });

  it("moves the stable node and rejects stale sources, collisions, and unsafe descendants through VFS authority", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now: environment.now() });
    if (!folder.ok) throw new Error("Fixture failed");
    const child = createVfsDirectory(folder.state, "/home/user/Documents/A", "Sub", { now: environment.now() });
    if (!child.ok) throw new Error("Fixture failed");
    const store = makeStore(child.state);
    const request = createKonquerorDirectTransferRequest(store.state, "move", "konqueror-a", store.state.specialLocations.documents, [folder.value.id]);
    if (!request.ok) throw new Error("Request failed");

    expect(submitKonquerorDirectTransfer(store.state, request.value, "/home/user/Documents/A/Sub", store.operations, environment)).toMatchObject({
      ok: false,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(submitKonquerorDirectTransfer(store.state, request.value, "/home/user/Downloads", store.operations, environment)).toMatchObject({ ok: true });
    expect(getVfsPathForNode(store.state, folder.value.id)).toMatchObject({ ok: true, value: "/home/user/Downloads/A" });
    expect(submitKonquerorDirectTransfer(store.state, request.value, "/home/user/Music", store.operations, environment)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("does not use clipboard state, hosts, or a second mutation API", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./directTransferController.ts", import.meta.url), "utf8");
    const applicationSource = await readFile(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(source).toContain("executeKonquerorFileTransfer");
    expect(source).not.toContain("clipboardState");
    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("showDirectoryPicker");
    expect(source).not.toContain("copyVfsNode");
    const directTransferSection = applicationSource.slice(
      applicationSource.indexOf("const openDirectTransferDialog"),
      applicationSource.indexOf("const openProperties"),
    );
    expect(directTransferSection).not.toContain("dispatchClipboard");
    expect(directTransferSection).not.toContain("desktopSession");
  });
});
