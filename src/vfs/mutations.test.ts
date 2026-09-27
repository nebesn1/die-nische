import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import {
  appendVfsTextFile,
  copyVfsNodes,
  createVfsDirectory,
  createVfsTextFile,
  moveVfsNodesToTrash,
  renameVfsNode,
  writeVfsTextFile,
} from "./mutations";
import { listVfsDirectory, readVfsTextFile, resolveVfsPath } from "./queries";

const now = "2026-08-02T00:00:00.000Z";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }

  return value;
};

describe("VFS mutations", () => {
  it("creates a directory with immutable parent updates", () => {
    const state = deepFreeze(createInitialVfsState());
    const oldDocuments = state.nodesById[state.specialLocations.documents];
    const oldDocumentChildIds = oldDocuments.kind === "directory" ? oldDocuments.childIds : [];
    const result = createVfsDirectory(state, "/home/user/Documents", "Projects", { now });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("create directory failed");
    }

    expect(result.state).not.toBe(state);
    expect(result.state.nodesById).not.toBe(state.nodesById);
    expect(result.value.id).toBe("vfs-node-0010");
    expect(result.value.childIds).toEqual([]);
    expect(result.state.revision).toBe(state.revision + 1);
    expect(result.state.nextNodeSequence).toBe(11);
    expect(result.state.nodesById[state.specialLocations.documents]).not.toBe(oldDocuments);
    expect(result.state.nodesById[state.specialLocations.home]).toBe(state.nodesById[state.specialLocations.home]);
    expect(expectOk(resolveVfsPath(result.state, "/home/user/Documents/Projects")).id).toBe(result.value.id);
    expect(result.state.nodesById[state.specialLocations.documents]?.modifiedAt).toBe(now);
    expect(oldDocuments.kind === "directory" ? oldDocuments.childIds : []).toEqual(oldDocumentChildIds);
  });

  it("rejects invalid directory creation without changing state", () => {
    const state = createInitialVfsState();
    const duplicate = createVfsDirectory(state, "/home/user", "Documents", { now });
    const underFile = createVfsDirectory(state, "/home/user/Documents/Welcome.md", "Child", { now });

    expect(duplicate).toMatchObject({ ok: false, state, error: { code: "ALREADY_EXISTS" } });
    expect(underFile).toMatchObject({ ok: false, state, error: { code: "NOT_DIRECTORY" } });
    expect(duplicate.state.revision).toBe(state.revision);
  });

  it("creates text files with default and custom MIME and UTF-8 byte sizes", () => {
    const state = createInitialVfsState();
    const initialDocumentNames = expectOk(listVfsDirectory(state, "/home/user/Documents")).map((node) => node.name);
    const ascii = createVfsTextFile(state, "/home/user/Documents", "Readme.txt", "abc", { now });

    expect(ascii.ok).toBe(true);

    if (!ascii.ok) {
      throw new Error("create ASCII file failed");
    }

    const chinese = createVfsTextFile(ascii.state, "/home/user/Documents", "中文.txt", "你好", {
      now,
      mimeType: "text/markdown",
    });

    expect(chinese.ok).toBe(true);

    if (!chinese.ok) {
      throw new Error("create UTF-8 file failed");
    }

    expect(ascii.value.size).toBe(3);
    expect(ascii.value.mimeType).toBe("text/plain");
    expect(chinese.value.size).toBe(6);
    expect(chinese.value.mimeType).toBe("text/markdown");
    expect(expectOk(listVfsDirectory(chinese.state, "/home/user/Documents")).map((node) => node.name)).toEqual([
      ...initialDocumentNames,
      "Readme.txt",
      "中文.txt",
    ]);
  });

  it("does not overwrite existing files and permits case-distinct names", () => {
    const state = createInitialVfsState();
    const readme = createVfsTextFile(state, "/home/user/Documents", "Readme.txt", "a", { now });

    if (!readme.ok) {
      throw new Error("create Readme failed");
    }

    const upper = createVfsTextFile(readme.state, "/home/user/Documents", "README.txt", "b", { now });
    const duplicate = createVfsTextFile(readme.state, "/home/user/Documents", "Readme.txt", "c", { now });

    expect(upper.ok).toBe(true);
    expect(duplicate).toMatchObject({ ok: false, state: readme.state, error: { code: "ALREADY_EXISTS" } });
  });

  it("writes text content while preserving id createdAt and order", () => {
    const state = createInitialVfsState();
    const initialDocumentChildIds = expectOk(listVfsDirectory(state, "/home/user/Documents")).map((node) => node.id);
    const oldFile = expectOk(readVfsTextFile(state, "/home/user/Documents/Welcome.md"));
    const written = writeVfsTextFile(state, "/home/user/Documents/Welcome.md", "Changed", { now });

    expect(written.ok).toBe(true);

    if (!written.ok) {
      throw new Error("write failed");
    }

    expect(written.value.id).toBe(oldFile.id);
    expect(written.value.createdAt).toBe(oldFile.createdAt);
    expect(written.value.modifiedAt).toBe(now);
    expect(written.value.size).toBe(7);
    expect(expectOk(listVfsDirectory(written.state, "/home/user/Documents")).map((node) => node.id)).toEqual(initialDocumentChildIds);
    expect(written.state.nodesById[oldFile.id]).not.toBe(oldFile);
  });

  it("handles write failures and same-content writes deterministically", () => {
    const state = createInitialVfsState();
    const oldFile = expectOk(readVfsTextFile(state, "/home/user/Documents/Welcome.md"));
    const same = writeVfsTextFile(state, "/home/user/Documents/Welcome.md", oldFile.content.text, { now });
    const directory = writeVfsTextFile(state, "/home/user/Documents", "no", { now });
    const missing = writeVfsTextFile(state, "/home/user/Documents/Missing.txt", "no", { now });

    expect(same).toMatchObject({ ok: true, state });
    expect(same.state.revision).toBe(state.revision);
    expect(directory).toMatchObject({ ok: false, state, error: { code: "IS_DIRECTORY" } });
    expect(missing).toMatchObject({ ok: false, state, error: { code: "NOT_FOUND" } });
  });

  it("appends UTF-8 text atomically while preserving identity and directory order", () => {
    const state = deepFreeze(createInitialVfsState());
    const initialDocumentChildIds = expectOk(listVfsDirectory(state, "/home/user/Documents")).map((node) => node.id);
    const oldFile = expectOk(readVfsTextFile(state, "/home/user/Documents/Notes.txt"));
    const oldParent = state.nodesById[state.specialLocations.documents];
    const appended = appendVfsTextFile(state, "/home/user/Documents/Notes.txt", "追加\n", { now });

    expect(appended.ok).toBe(true);

    if (!appended.ok) {
      throw new Error("append failed");
    }

    expect(appended.state).not.toBe(state);
    expect(appended.value.id).toBe(oldFile.id);
    expect(appended.value.parentId).toBe(oldFile.parentId);
    expect(appended.value.createdAt).toBe(oldFile.createdAt);
    expect(appended.value.modifiedAt).toBe(now);
    expect(appended.value.content).toEqual({ kind: "text", text: `${oldFile.content.text}追加\n` });
    expect(appended.value.size).toBe(new TextEncoder().encode(`${oldFile.content.text}追加\n`).length);
    expect(appended.state.revision).toBe(state.revision + 1);
    expect(appended.state.nextNodeSequence).toBe(state.nextNodeSequence);
    expect(appended.state.nodesById[state.specialLocations.documents]).toBe(oldParent);
    expect(expectOk(listVfsDirectory(appended.state, "/home/user/Documents")).map((node) => node.id)).toEqual(initialDocumentChildIds);
  });

  it("handles append no-op and failures without changing state", () => {
    const state = createInitialVfsState();
    const oldFile = expectOk(readVfsTextFile(state, "/home/user/Documents/Welcome.md"));
    const empty = appendVfsTextFile(state, "/home/user/Documents/Welcome.md", "", { now });
    const directory = appendVfsTextFile(state, "/home/user/Documents", "no", { now });
    const missing = appendVfsTextFile(state, "/home/user/Documents/Missing.txt", "no", { now });

    expect(empty).toMatchObject({ ok: true, state });
    expect(empty.ok ? empty.value : null).toBe(oldFile);
    expect(empty.state.revision).toBe(state.revision);
    expect(directory).toMatchObject({ ok: false, state, error: { code: "IS_DIRECTORY" } });
    expect(missing).toMatchObject({ ok: false, state, error: { code: "NOT_FOUND" } });
  });

  it("renames files and directories without changing ids or child order", () => {
    const state = createInitialVfsState();
    const renamedFile = renameVfsNode(state, "/home/user/Documents/Notes.txt", "Notes-renamed.txt", { now });

    expect(renamedFile.ok).toBe(true);

    if (!renamedFile.ok) {
      throw new Error("rename file failed");
    }

    const renamedDirectory = renameVfsNode(renamedFile.state, "/home/user/Documents", "Docs", { now });

    expect(renamedDirectory.ok).toBe(true);

    if (!renamedDirectory.ok) {
      throw new Error("rename directory failed");
    }

    expect(renamedFile.value.id).toBe("vfs-content-e594a065214576326cb903a5");
    expect(renamedDirectory.value.id).toBe("vfs-documents");
    expect(expectOk(resolveVfsPath(renamedDirectory.state, "/home/user/Docs/Notes-renamed.txt")).id).toBe("vfs-content-e594a065214576326cb903a5");
    expect(expectOk(listVfsDirectory(renamedDirectory.state, "/home/user")).map((node) => node.id)).toEqual([
      "vfs-desktop",
      "vfs-documents",
      "vfs-downloads",
      "vfs-music",
      "vfs-pictures",
      "vfs-videos",
      "vfs-local",
    ]);
  });

  it("rejects invalid renames without mutation", () => {
    const state = createInitialVfsState();

    expect(renameVfsNode(state, "/", "root", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "ROOT_OPERATION_FORBIDDEN" },
    });
    expect(renameVfsNode(state, "/home/user/Documents/Notes.txt", "Welcome.md", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "ALREADY_EXISTS" },
    });
    expect(renameVfsNode(state, "/home/user/Documents/Notes.txt", "bad/name", { now })).toMatchObject({
      ok: false,
      state,
      error: { code: "INVALID_NAME" },
    });
  });

  it("does not mutate the initial seed across mutations", () => {
    const state = createInitialVfsState();
    const created = createVfsDirectory(state, "/home/user/Documents", "Projects", { now });

    expect(created.ok).toBe(true);
    expect(resolveVfsPath(state, "/home/user/Documents/Projects")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(createInitialVfsState().nodesById["vfs-documents"]).toEqual(state.nodesById["vfs-documents"]);
  });

  it("preflights multi-node mutations against an unpublished candidate state", () => {
    const state = createInitialVfsState();
    const copied = copyVfsNodes(
      state,
      ["/home/user/Documents/Notes.txt", "/home/user/Documents/Welcome.md"],
      "/home/user/Downloads",
      { now },
    );
    const collision = copyVfsNodes(
      state,
      ["/home/user/Documents/Notes.txt", "/home/user/Documents/Welcome.md"],
      "/home/user/Documents",
      { now },
    );
    const protectedTrash = moveVfsNodesToTrash(
      state,
      ["/home/user/Documents/Notes.txt", "/home/user/Documents"],
      { now },
    );

    expect(copied).toMatchObject({ ok: true, value: [expect.objectContaining({ name: "Notes.txt" }), expect.objectContaining({ name: "Welcome.md" })] });
    expect(collision).toMatchObject({ ok: false, state, error: { code: "ALREADY_EXISTS" } });
    expect(protectedTrash).toMatchObject({ ok: false, state, error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" } });
  });
});
