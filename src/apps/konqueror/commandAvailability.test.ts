import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { getKonquerorCommandAvailability } from "./commandAvailability";
import type { KonquerorView } from "./navigationTypes";

describe("Konqueror command availability", () => {
  it("allows create commands in directory view", () => {
    const state = createInitialVfsState();
    const home = state.nodesById[state.specialLocations.home];

    if (home.kind !== "directory") {
      throw new Error("fixture home missing");
    }

    const availability = getKonquerorCommandAvailability(
      state,
      { type: "directory", node: home, path: "/home/user", children: [] },
      [],
    );

    expect(availability.canCreateNewFolder).toBe(true);
    expect(availability.canCreateNewTextFile).toBe(true);
    expect(availability.canRename).toBe(false);
  });

  it("disables directory mutation commands in a read-only file preview", () => {
    const state = createInitialVfsState();
    const file = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

    if (file.kind !== "file") {
      throw new Error("fixture file missing");
    }

    const availability = getKonquerorCommandAvailability(
      state,
      { type: "file", node: file, path: "/home/user/Documents/Welcome.md" },
      [],
    );

    expect(availability.canCreateNewFolder).toBe(false);
    expect(availability.canCreateNewTextFile).toBe(false);
    expect(availability.canRename).toBe(false);
    expect(availability.renameTargetNodeId).toBeNull();
    expect(availability.renameTargetName).toBeNull();
  });

  it("allows rename only when a directory item is selected", () => {
    const state = createInitialVfsState();
    const home = state.nodesById[state.specialLocations.home];

    if (home.kind !== "directory") {
      throw new Error("fixture home missing");
    }

    const view: KonquerorView = {
      type: "directory",
      node: home,
      path: "/home/user",
      children: [state.nodesById[state.specialLocations.documents]],
    };

    expect(getKonquerorCommandAvailability(state, view, []).canRename).toBe(false);
    expect(getKonquerorCommandAvailability(state, view, [state.specialLocations.documents])).toMatchObject({
      canRename: true,
      renameTargetNodeId: state.specialLocations.documents,
      renameTargetName: "Documents",
    });
  });

  it("does not allow renaming root", () => {
    const state = createInitialVfsState();
    const root = state.nodesById[state.rootId];

    if (root.kind !== "directory") {
      throw new Error("fixture root missing");
    }

    expect(
      getKonquerorCommandAvailability(
        state,
        { type: "directory", node: root, path: "/", children: [root] },
        [state.rootId],
      ).canRename,
    ).toBe(false);
  });

  it("requires exactly one selection before enabling rename", () => {
    const state = createInitialVfsState();
    const home = state.nodesById[state.specialLocations.home];

    if (home.kind !== "directory") throw new Error("fixture home missing");

    const availability = getKonquerorCommandAvailability(
      state,
      { type: "directory", node: home, path: "/home/user", children: [] },
      [state.specialLocations.documents, state.specialLocations.downloads],
    );

    expect(availability.canRename).toBe(false);
    expect(availability.renameTargetNodeId).toBeNull();
    expect(availability.renameDisabledTitle).toBe("Select exactly one file or folder before renaming");
  });
});
