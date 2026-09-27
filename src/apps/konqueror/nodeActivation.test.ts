import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsTextFile } from "../../vfs/mutations";
import { getVfsNodeById } from "../../vfs/queries";
import { getKonquerorNodeActivation } from "./nodeActivation";

describe("Konqueror node activation", () => {
  it("navigates directories and previews text files by VFS node kind", () => {
    const state = createInitialVfsState();
    const home = getVfsNodeById(state, state.specialLocations.home);

    if (!home.ok || home.value.kind !== "directory") {
      throw new Error("expected the home directory fixture");
    }

    const created = createVfsTextFile(state, "/home/user/Documents", "README", "", {
      now: "2026-08-10T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("expected to create a text file fixture");
    }

    expect(getKonquerorNodeActivation(home.value)).toEqual({ type: "navigate-directory", nodeId: home.value.id });
    expect(getKonquerorNodeActivation(created.value)).toEqual({
      type: "preview-text-file",
      nodeId: created.value.id,
    });
  });
});
