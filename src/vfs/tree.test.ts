import { describe, expect, it } from "vitest";
import { createVfsDirectory, createVfsTextFile, moveVfsNodeToTrash } from "./mutations";
import { createInitialVfsState } from "./initialState";
import {
  createAvailableVfsName,
  getVfsDescendantIds,
  isProtectedVfsNode,
  isVfsNodeDescendantOf,
  isVfsNodeInsideTrash,
} from "./tree";
import type { VfsDirectoryNode, VfsState } from "./types";

const now = "2026-08-02T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) {
    throw new Error("Expected ok mutation");
  }

  return {
    state: result.state,
    value: result.value,
  };
};

const createProjectTree = (): VfsState => {
  const project = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Project", { now }));
  const subfolder = expectMutation(createVfsDirectory(project.state, "/home/user/Documents/Project", "Subfolder", { now }));
  const file = expectMutation(createVfsTextFile(subfolder.state, "/home/user/Documents/Project/Subfolder", "Plan.txt", "plan", { now }));

  return file.state;
};

describe("VFS tree helpers", () => {
  it("returns deterministic descendants in depth-first childIds order", () => {
    const state = createProjectTree();
    const descendants = getVfsDescendantIds(state, "vfs-node-0010");

    expect(descendants).toMatchObject({
      ok: true,
      value: ["vfs-node-0011", "vfs-node-0012"],
    });
  });

  it("returns no descendants for files and detects descendant relationships", () => {
    const state = createProjectTree();

    expect(getVfsDescendantIds(state, "vfs-node-0012")).toMatchObject({ ok: true, value: [] });
    expect(isVfsNodeDescendantOf(state, "vfs-node-0012", "vfs-node-0010")).toBe(true);
    expect(isVfsNodeDescendantOf(state, "vfs-node-0010", "vfs-node-0012")).toBe(false);
  });

  it("detects Trash containment and protected special locations", () => {
    const state = createProjectTree();
    const trashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now })).state;

    expect(isVfsNodeInsideTrash(trashed, "vfs-node-0010")).toBe(true);
    expect(isVfsNodeInsideTrash(trashed, "vfs-node-0012")).toBe(true);
    expect(isVfsNodeInsideTrash(trashed, trashed.specialLocations.documents)).toBe(false);
    expect(isProtectedVfsNode(trashed, trashed.specialLocations.documents)).toBe(true);
    expect(isProtectedVfsNode(trashed, "vfs-node-0010")).toBe(false);
  });

  it("generates deterministic available names with extension preservation", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Report.txt", "", { now })).state;
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Report (1).txt", "", { now })).state;
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Project", { now })).state;

    expect(createAvailableVfsName(state, state.specialLocations.documents, "Report.txt")).toBe("Report (2).txt");
    expect(createAvailableVfsName(state, state.specialLocations.documents, "Project")).toBe("Project (1)");
    expect(createAvailableVfsName(state, state.specialLocations.documents, ".profile")).toBe(".profile");
  });

  it("returns a controlled error for damaged descendant traversal", () => {
    const state = createProjectTree();
    const project = state.nodesById["vfs-node-0010"] as VfsDirectoryNode;
    const damaged: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [project.id]: {
          ...project,
          childIds: [...project.childIds, project.id],
        },
      },
    };

    expect(getVfsDescendantIds(damaged, project.id)).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
  });
});
