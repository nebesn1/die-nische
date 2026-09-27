import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, deleteVfsNodePermanently, moveVfsNode, moveVfsNodeToTrash } from "../../vfs/mutations";
import { getVfsPathForNode, listVfsDirectory, resolveVfsPath } from "../../vfs/queries";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { KonquerorCommandDialogState, KonquerorCommandEnvironment } from "./commandTypes";
import { buildRenamedPath, submitKonquerorCommand } from "./mutationController";

const environment: KonquerorCommandEnvironment = {
  now: () => "2003-04-06T12:30:00.000Z",
};

const createStore = (initialState = createInitialVfsState()) => {
  let state = initialState;
  const operations = createVfsOperations(
    () => state,
    (nextState) => {
      state = nextState;
    },
  );

  return {
    get state() {
      return state;
    },
    operations,
  };
};

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

describe("Konqueror mutation controller", () => {
  it("creates a folder in the current directory and selects the new node", () => {
    const store = createStore();
    const dialog: KonquerorCommandDialogState = {
      kind: "new-folder",
      parentNodeId: store.state.specialLocations.documents,
      preserveSelection: false,
      draftName: "Projects",
      error: null,
    };
    const result = submitKonquerorCommand(store.state, dialog, store.operations, environment, "/home/user/Documents");

    expect(result).toMatchObject({
      ok: true,
      value: { kind: "created", currentPath: "/home/user/Documents" },
    });

    if (!result.ok) {
      throw new Error("create folder failed");
    }

    const created = expectOk(resolveVfsPath(store.state, "/home/user/Documents/Projects"));

    expect(created.id).toBe(result.value.nodeId);
    expect(created.kind).toBe("directory");
    expect(created.kind === "directory" ? created.childIds : []).toEqual([]);
    expect(store.state.revision).toBe(1);
    expect(store.state.nodesById[created.id].modifiedAt).toBe("2003-04-06T12:30:00.000Z");
  });

  it("creates an empty UTF-8 text file without adding an extension", () => {
    const store = createStore();
    const dialog: KonquerorCommandDialogState = {
      kind: "new-text-file",
      parentNodeId: store.state.specialLocations.documents,
      draftName: "Todo",
      error: null,
    };
    const result = submitKonquerorCommand(store.state, dialog, store.operations, environment, "/home/user/Documents");
    const created = expectOk(resolveVfsPath(store.state, "/home/user/Documents/Todo"));

    expect(result.ok).toBe(true);
    expect(created).toMatchObject({
      kind: "file",
      name: "Todo",
      content: { kind: "text", text: "" },
      size: 0,
      mimeType: "text/plain",
      encoding: "utf-8",
    });
  });

  it("appends new nodes in childIds order and uses latest provider state for consecutive creates", () => {
    const store = createStore();
    const folderA: KonquerorCommandDialogState = {
      kind: "new-folder",
      parentNodeId: store.state.specialLocations.documents,
      preserveSelection: false,
      draftName: "FolderA",
      error: null,
    };
    const folderB: KonquerorCommandDialogState = {
      kind: "new-folder",
      parentNodeId: store.state.specialLocations.documents,
      preserveSelection: false,
      draftName: "FolderB",
      error: null,
    };

    const first = submitKonquerorCommand(store.state, folderA, store.operations, environment, "/home/user/Documents");
    const second = submitKonquerorCommand(store.state, folderB, store.operations, environment, "/home/user/Documents");
    const names = expectOk(listVfsDirectory(store.state, "/home/user/Documents")).map((node) => node.name);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(names.slice(-2)).toEqual(["FolderA", "FolderB"]);
    expect(store.state.revision).toBe(2);
    expect(first.ok && second.ok ? first.value.nodeId : "").not.toBe(second.ok ? second.value.nodeId : "");
  });

  it("keeps dialog-open failures from mutating state", () => {
    const store = createStore();
    const before = store.state;
    const duplicate: KonquerorCommandDialogState = {
      kind: "new-folder",
      parentNodeId: store.state.specialLocations.documents,
      preserveSelection: false,
      draftName: "Notes.txt",
      error: null,
    };
    const invalid: KonquerorCommandDialogState = {
      ...duplicate,
      draftName: "bad/name",
    };

    expect(submitKonquerorCommand(store.state, duplicate, store.operations, environment, "/home/user/Documents")).toMatchObject({
      ok: false,
      error: { code: "ALREADY_EXISTS" },
    });
    expect(store.state).toBe(before);
    expect(submitKonquerorCommand(store.state, invalid, store.operations, environment, "/home/user/Documents")).toMatchObject({
      ok: false,
      error: { code: "INVALID_NAME" },
    });
    expect(store.state).toBe(before);
  });

  it("resolves a frozen folder target by stable node id at submit time", () => {
    const target = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Target", { now: environment.now() });
    if (!target.ok) throw new Error("Target fixture failed");
    const moved = moveVfsNode(target.state, "/home/user/Documents/Target", "/home/user/Pictures", { now: environment.now() });
    if (!moved.ok) throw new Error("Move fixture failed");
    const store = createStore(moved.state);
    const dialog: KonquerorCommandDialogState = {
      kind: "new-folder",
      parentNodeId: target.value.id,
      preserveSelection: true,
      draftName: "Child",
      error: null,
    };

    expect(submitKonquerorCommand(store.state, dialog, store.operations, environment, "/home/user/Documents")).toMatchObject({ ok: true });
    expect(resolveVfsPath(store.state, "/home/user/Pictures/Target/Child")).toMatchObject({ ok: true });
    expect(resolveVfsPath(store.state, "/home/user/Documents/Target/Child")).toMatchObject({ ok: false });
  });

  it("rejects a deleted frozen folder target without falling back to the current directory", () => {
    const target = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Target", { now: environment.now() });
    if (!target.ok) throw new Error("Target fixture failed");
    const trashed = moveVfsNodeToTrash(target.state, "/home/user/Documents/Target", { now: environment.now() });
    if (!trashed.ok) throw new Error("Trash fixture failed");
    const deleted = deleteVfsNodePermanently(trashed.state, target.value.id, { now: environment.now() });
    if (!deleted.ok) throw new Error("Delete fixture failed");
    const store = createStore(deleted.state);
    const dialog: KonquerorCommandDialogState = {
      kind: "new-folder",
      parentNodeId: target.value.id,
      preserveSelection: true,
      draftName: "Child",
      error: null,
    };

    expect(submitKonquerorCommand(store.state, dialog, store.operations, environment, "/home/user/Documents")).toMatchObject({
      ok: false,
      error: { code: "INVALID_DESTINATION", message: "The target folder no longer exists." },
    });
    expect(resolveVfsPath(store.state, "/home/user/Documents/Child")).toMatchObject({ ok: false });
  });

  it("renames a file without changing node id, parent, or history target", () => {
    const store = createStore();
    const before = store.state;
    const welcome = before.nodesById["vfs-content-76cff3ce17d8a853403179f1"];
    const documents = before.nodesById[before.specialLocations.documents];
    const dialog: KonquerorCommandDialogState = {
      kind: "rename",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalName: "Welcome.md",
      draftName: "Intro.txt",
      error: null,
    };
    const result = submitKonquerorCommand(store.state, dialog, store.operations, environment, "/home/user/Documents/Welcome.md");
    const renamed = expectOk(resolveVfsPath(store.state, "/home/user/Documents/Intro.txt"));

    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: "renamed",
        nodeId: "vfs-content-76cff3ce17d8a853403179f1",
        renamedPath: "/home/user/Documents/Intro.txt",
      },
    });
    expect(renamed.id).toBe("vfs-content-76cff3ce17d8a853403179f1");
    expect(renamed.parentId).toBe(welcome.parentId);
    expect(store.state.nodesById[store.state.specialLocations.documents]).toMatchObject({
      childIds: documents.kind === "directory" ? documents.childIds : [],
    });
    expect(store.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"].createdAt).toBe(welcome.createdAt);
    expect(store.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"].modifiedAt).toBe("2003-04-06T12:30:00.000Z");
    expect(getVfsPathForNode(store.state, "vfs-content-76cff3ce17d8a853403179f1")).toMatchObject({
      ok: true,
      value: "/home/user/Documents/Intro.txt",
    });
  });

  it("renames a directory and updates descendant paths naturally", () => {
    const store = createStore();
    const dialog: KonquerorCommandDialogState = {
      kind: "rename",
      targetNodeId: store.state.specialLocations.documents,
      originalName: "Documents",
      draftName: "Docs",
      error: null,
    };

    expect(submitKonquerorCommand(store.state, dialog, store.operations, environment, "/home/user")).toMatchObject({
      ok: true,
      value: { nodeId: store.state.specialLocations.documents },
    });
    expect(getVfsPathForNode(store.state, "vfs-content-76cff3ce17d8a853403179f1")).toMatchObject({
      ok: true,
      value: "/home/user/Docs/Welcome.md",
    });
  });

  it("keeps failed and root rename deterministic", () => {
    const store = createStore();
    const before = store.state;
    const duplicate: KonquerorCommandDialogState = {
      kind: "rename",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalName: "Welcome.md",
      draftName: "Notes.txt",
      error: null,
    };
    const root: KonquerorCommandDialogState = {
      kind: "rename",
      targetNodeId: store.state.rootId,
      originalName: "",
      draftName: "root",
      error: null,
    };

    expect(submitKonquerorCommand(store.state, duplicate, store.operations, environment, "/home/user/Documents")).toMatchObject({
      ok: false,
      error: { code: "ALREADY_EXISTS" },
    });
    expect(store.state).toBe(before);
    expect(submitKonquerorCommand(store.state, root, store.operations, environment, "/")).toMatchObject({
      ok: false,
      error: { code: "ROOT_OPERATION_FORBIDDEN" },
    });
  });

  it("treats same-name rename as a successful no-op", () => {
    const store = createStore();
    const before = store.state;
    const same: KonquerorCommandDialogState = {
      kind: "rename",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalName: "Welcome.md",
      draftName: "Welcome.md",
      error: null,
    };

    expect(submitKonquerorCommand(store.state, same, store.operations, environment, "/home/user/Documents/Welcome.md")).toMatchObject({
      ok: true,
      value: { renamedPath: "/home/user/Documents/Welcome.md" },
    });
    expect(store.state).toBe(before);
    expect(store.state.revision).toBe(0);
  });

  it("builds renamed paths without storing stale history paths", () => {
    const state = createInitialVfsState();

    expect(buildRenamedPath("/home/user/Documents/Welcome.md", state.nodesById["vfs-content-e594a065214576326cb903a5"])).toBe(
      "/home/user/Documents/Notes.txt",
    );
  });
});
