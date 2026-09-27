import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { renameVfsNode } from "../../vfs/mutations";
import { getVfsPathForNode, readVfsTextFile } from "../../vfs/queries";
import type { VfsFileNode, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { KonquerorEditorState } from "./editorTypes";
import { saveKonquerorTextFile } from "./saveTextController";

const environment = {
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

const createEditor = (state: VfsState, draftContent: string): KonquerorEditorState => {
  const file = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

  if (file.kind !== "file" || file.content.kind !== "text") {
    throw new Error("fixture file missing");
  }

  return {
    kind: "editing",
    targetNodeId: file.id,
    originalContent: file.content.text,
    draftContent,
    originalModifiedAt: file.modifiedAt,
    saveError: null,
  };
};

const getRepositoryImage = (state: VfsState): VfsFileNode => {
  const image = Object.values(state.nodesById).find((node): node is VfsFileNode =>
    node.kind === "file" && node.parentId === state.specialLocations.pictures && node.content.kind === "asset-url",
  );
  if (!image) throw new Error("Repository image fixture missing");
  return image;
};

describe("Konqueror save text controller", () => {
  it("rejects an asset-backed target before it can enter the text write path", () => {
    const store = createStore();
    const result = saveKonquerorTextFile(store.state, {
      kind: "editing",
      targetNodeId: getRepositoryImage(store.state).id,
      originalContent: "",
      draftContent: "replacement",
      originalModifiedAt: "2004-08-25T12:00:00.000Z",
      saveError: null,
    }, store.operations, environment);

    expect(result).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_FILE_CONTENT" } });
    expect(store.state.revision).toBe(0);
  });

  it("saves ASCII content and preserves node identity fields", () => {
    const store = createStore();
    const before = store.state;
    const oldFile = before.nodesById["vfs-content-76cff3ce17d8a853403179f1"];
    const documents = before.nodesById[before.specialLocations.documents];
    const result = saveKonquerorTextFile(store.state, createEditor(store.state, "Changed"), store.operations, environment);

    expect(result).toMatchObject({
      ok: true,
      value: {
        nodeId: "vfs-content-76cff3ce17d8a853403179f1",
        file: {
          id: "vfs-content-76cff3ce17d8a853403179f1",
          content: { kind: "text", text: "Changed" },
          size: 7,
          modifiedAt: "2003-04-06T12:30:00.000Z",
        },
      },
    });
    expect(store.state.revision).toBe(before.revision + 1);
    expect(store.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"].createdAt).toBe(oldFile.createdAt);
    expect(store.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"].parentId).toBe(oldFile.parentId);
    expect(store.state.nodesById[before.specialLocations.documents]).toBe(documents);
  });

  it("saves UTF-8 and empty content with byte sizes from VFS", () => {
    const store = createStore();
    const chinese = saveKonquerorTextFile(store.state, createEditor(store.state, "中文"), store.operations, environment);
    const empty = saveKonquerorTextFile(store.state, createEditor(store.state, ""), store.operations, environment);

    expect(chinese).toMatchObject({ ok: true, value: { file: { size: 6, content: { kind: "text", text: "中文" } } } });
    expect(empty).toMatchObject({ ok: true, value: { file: { size: 0, content: { kind: "text", text: "" } } } });
    expect(store.state.revision).toBe(2);
  });

  it("treats same-content save as a successful no-op", () => {
    const store = createStore();
    const before = store.state;
    const file = before.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

    if (file.kind !== "file" || file.content.kind !== "text") {
      throw new Error("fixture file missing");
    }

    const result = saveKonquerorTextFile(store.state, createEditor(store.state, file.content.text), store.operations, environment);

    expect(result).toMatchObject({ ok: true, value: { nodeId: "vfs-content-76cff3ce17d8a853403179f1" } });
    expect(store.state).toBe(before);
    expect(store.state.revision).toBe(before.revision);
    expect(store.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"].modifiedAt).toBe(file.modifiedAt);
  });

  it("keeps failures controlled without changing VFS state", () => {
    const store = createStore();
    const before = store.state;
    const missing: KonquerorEditorState = {
      kind: "editing",
      targetNodeId: "missing-node",
      originalContent: "",
      draftContent: "Changed",
      originalModifiedAt: "",
      saveError: null,
    };
    const directoryTarget: KonquerorEditorState = {
      ...missing,
      targetNodeId: store.state.specialLocations.documents,
    };

    expect(saveKonquerorTextFile(store.state, missing, store.operations, environment)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(saveKonquerorTextFile(store.state, directoryTarget, store.operations, environment)).toMatchObject({
      ok: false,
      error: { code: "IS_DIRECTORY" },
    });
    expect(store.state).toBe(before);
  });

  it("derives the latest path from node id after rename before saving", () => {
    const store = createStore();
    const file = store.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

    if (file.kind !== "file" || file.content.kind !== "text") {
      throw new Error("fixture file missing");
    }

    const editor: KonquerorEditorState = {
      kind: "editing",
      targetNodeId: file.id,
      originalContent: file.content.text,
      draftContent: "Saved after rename",
      originalModifiedAt: file.modifiedAt,
      saveError: null,
    };
    const renamed = renameVfsNode(store.state, "/home/user/Documents/Welcome.md", "Intro.txt", {
      now: "2003-04-06T12:00:00.000Z",
    });

    if (!renamed.ok) {
      throw new Error("fixture rename failed");
    }

    store.operations.renameNode("/home/user/Documents/Welcome.md", "Intro.txt", {
      now: "2003-04-06T12:00:00.000Z",
    });
    expect(getVfsPathForNode(store.state, "vfs-content-76cff3ce17d8a853403179f1")).toMatchObject({
      ok: true,
      value: "/home/user/Documents/Intro.txt",
    });

    const result = saveKonquerorTextFile(store.state, editor, store.operations, environment);

    expect(result).toMatchObject({ ok: true, value: { nodeId: "vfs-content-76cff3ce17d8a853403179f1" } });
    expect(readVfsTextFile(store.state, "/home/user/Documents/Intro.txt")).toMatchObject({
      ok: true,
      value: { content: { kind: "text", text: "Saved after rename" } },
    });
  });
});
