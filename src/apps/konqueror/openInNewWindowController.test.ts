import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsLinks } from "../../vfs/mutations";
import { planKonquerorOpenInNewWindow } from "./openInNewWindowController";

describe("Konqueror Open in New Window planner", () => {
  it("resolves mixed Resource targets in the supplied visible order", () => {
    const state = createInitialVfsState();
    const plan = planKonquerorOpenInNewWindow(state, ["vfs-content-76cff3ce17d8a853403179f1", state.specialLocations.documents, "vfs-content-e594a065214576326cb903a5"]);

    expect(plan).toEqual({
      ok: true,
      value: [
        { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" },
        { type: "open-directory", nodeId: state.specialLocations.documents },
        { type: "open-file", nodeId: "vfs-content-e594a065214576326cb903a5" },
      ],
    });
  });

  it("preflights the entire group and produces no partial plan for an invalid target", () => {
    const state = createInitialVfsState();
    const plan = planKonquerorOpenInNewWindow(state, [state.specialLocations.documents, "missing-node"]);

    expect(plan).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("treats an empty group as a controlled no-op plan failure", () => {
    expect(planKonquerorOpenInNewWindow(createInitialVfsState(), [])).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("resolves Links to their final target before creating new-window intents", () => {
    const fileLink = createVfsLinks(createInitialVfsState(), "vfs-downloads", ["vfs-content-e594a065214576326cb903a5"], {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!fileLink.ok) throw new Error("file Link fixture failed");
    const folder = createVfsDirectory(fileLink.state, "/home/user/Documents", "Folder", {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!folder.ok) throw new Error("directory fixture failed");
    const directoryLink = createVfsLinks(folder.state, "vfs-downloads", [folder.value.id], {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!directoryLink.ok) throw new Error("directory Link fixture failed");

    expect(planKonquerorOpenInNewWindow(directoryLink.state, [fileLink.value[0]!.id, directoryLink.value[0]!.id])).toEqual({
      ok: true,
      value: [
        { type: "open-file", nodeId: "vfs-content-e594a065214576326cb903a5" },
        { type: "open-directory", nodeId: folder.value.id },
      ],
    });
  });
});
