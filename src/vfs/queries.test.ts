import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import {
  getVfsNodeById,
  getVfsPathForNode,
  listVfsDirectory,
  readVfsTextFile,
  resolveVfsPath,
} from "./queries";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

describe("VFS queries", () => {
  it("resolves directories and files by absolute and relative paths", () => {
    const state = createInitialVfsState();

    expect(expectOk(resolveVfsPath(state, "/home/user/Documents")).kind).toBe("directory");
    expect(expectOk(resolveVfsPath(state, "Welcome.md", "/home/user/Documents")).id).toBe("vfs-content-76cff3ce17d8a853403179f1");
    expect(expectOk(resolveVfsPath(state, "/")).id).toBe(state.rootId);
  });

  it("returns clear errors for missing paths and file path segments", () => {
    const state = createInitialVfsState();

    expect(resolveVfsPath(state, "/home/user/Missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(resolveVfsPath(state, "/home/user/Documents/Welcome.md/child")).toMatchObject({
      ok: false,
      error: { code: "NOT_DIRECTORY" },
    });
    expect(getVfsNodeById(state, "missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("lists directory children in childIds order without sorting", () => {
    const state = createInitialVfsState();
    const documents = listVfsDirectory(state, "/home/user/Documents");
    const home = listVfsDirectory(state, "/home/user");

    const documentsNode = state.nodesById[state.specialLocations.documents];
    if (!documentsNode || documentsNode.kind !== "directory") throw new Error("Documents fixture missing");
    expect(expectOk(documents).map((node) => node.id)).toEqual(documentsNode.childIds);
    expect(expectOk(home).map((node) => node.name)).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
      "Pictures",
      "Videos",
      ".local",
    ]);
  });

  it("rejects listing files and reading directories", () => {
    const state = createInitialVfsState();

    expect(listVfsDirectory(state, "/home/user/Documents/Welcome.md")).toMatchObject({
      ok: false,
      error: { code: "NOT_DIRECTORY" },
    });
    expect(readVfsTextFile(state, "/home/user/Documents")).toMatchObject({
      ok: false,
      error: { code: "IS_DIRECTORY" },
    });
  });

  it("reads text files and keeps the state unchanged", () => {
    const state = createInitialVfsState();
    const beforeRevision = state.revision;
    const file = expectOk(readVfsTextFile(state, "/home/user/Documents/Welcome.md"));

    expect(file.content.text).toContain("# Welcome to die Nische");
    expect(file.encoding).toBe("utf-8");
    expect(state.revision).toBe(beforeRevision);
  });

  it("reconstructs paths from node ids", () => {
    const state = createInitialVfsState();

    expect(expectOk(getVfsPathForNode(state, "vfs-content-76cff3ce17d8a853403179f1"))).toBe("/home/user/Documents/Welcome.md");
    expect(expectOk(getVfsPathForNode(state, state.rootId))).toBe("/");
    expect(getVfsPathForNode(state, "missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});
