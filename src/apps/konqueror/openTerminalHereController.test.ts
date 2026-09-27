import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile, moveVfsNodeToTrash } from "../../vfs/mutations";
import { planKonquerorOpenTerminalHere } from "./openTerminalHereController";

describe("Konqueror Open Terminal Here planner", () => {
  it("derives a canonical live path from the supplied folder identity", () => {
    const created = createVfsDirectory(createInitialVfsState(), "/home/user", "My Folder", {
      now: "2026-09-05T00:00:00.000Z",
    });
    if (!created.ok) throw new Error("directory fixture failed");

    expect(planKonquerorOpenTerminalHere(created.state, created.value.id)).toEqual({
      ok: true,
      value: { type: "open-working-directory", workingDirectory: "/home/user/My Folder" },
    });
    expect(planKonquerorOpenTerminalHere(created.state, created.state.rootId)).toEqual({
      ok: true,
      value: { type: "open-working-directory", workingDirectory: "/" },
    });
    expect(planKonquerorOpenTerminalHere(created.state, created.state.specialLocations.home)).toEqual({
      ok: true,
      value: { type: "open-working-directory", workingDirectory: "/home/user" },
    });
  });

  it("refuses ordinary files and the virtual Trash boundary", () => {
    const file = createVfsTextFile(createInitialVfsState(), "/home/user", "Notes.txt", "notes", {
      now: "2026-09-05T00:00:00.000Z",
    });
    if (!file.ok) throw new Error("file fixture failed");
    const trashed = moveVfsNodeToTrash(file.state, "/home/user/Notes.txt", {
      now: "2026-09-05T00:00:00.000Z",
    });
    if (!trashed.ok) throw new Error("trash fixture failed");

    expect(planKonquerorOpenTerminalHere(file.state, file.value.id)).toMatchObject({ ok: false, error: { code: "NOT_DIRECTORY" } });
    expect(planKonquerorOpenTerminalHere(trashed.state, trashed.state.specialLocations.trash)).toMatchObject({
      ok: false,
      error: { code: "INVALID_DESTINATION" },
    });
  });
});
