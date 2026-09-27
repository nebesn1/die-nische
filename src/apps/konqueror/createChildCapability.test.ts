import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsLinks, moveVfsNodeToTrash } from "../../vfs/mutations";
import { getKonquerorCreateChildAvailability } from "./createChildCapability";
import { canKonquerorAcceptFileDrop, canKonquerorDragResource } from "./dragDropController";

const now = "2026-08-31T08:00:00.000Z";

describe("Konqueror create-child capability", () => {
  it("allows ordinary VFS directories but excludes files and missing nodes", () => {
    const state = createInitialVfsState();

    expect(getKonquerorCreateChildAvailability(state, state.specialLocations.documents)).toMatchObject({
      canCreateChild: true,
      error: null,
    });
    expect(getKonquerorCreateChildAvailability(state, "vfs-content-76cff3ce17d8a853403179f1")).toMatchObject({
      canCreateChild: false,
      error: { code: "NOT_DIRECTORY" },
    });
    expect(getKonquerorCreateChildAvailability(state, "missing-node")).toMatchObject({
      canCreateChild: false,
      error: { code: "INVALID_DESTINATION", message: "The target folder no longer exists." },
    });
  });

  it("keeps Trash directories read-only, including nested descendants", () => {
    const created = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Archive", { now });
    if (!created.ok) throw new Error("Archive fixture failed");
    const trashed = moveVfsNodeToTrash(created.state, "/home/user/Documents/Archive", { now });
    if (!trashed.ok) throw new Error("Trash fixture failed");

    expect(getKonquerorCreateChildAvailability(trashed.state, trashed.value.id)).toMatchObject({
      canCreateChild: false,
      error: { code: "INVALID_DESTINATION" },
    });
  });

  it("keeps directory Links as draggable leaves, never writable child or drop targets", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Folder", { now });
    if (!folder.ok) throw new Error("Folder fixture failed");
    const linked = createVfsLinks(folder.state, "vfs-downloads", [folder.value.id], { now });
    if (!linked.ok) throw new Error("Link fixture failed");
    const linkId = linked.value[0]!.id;

    expect(getKonquerorCreateChildAvailability(linked.state, linkId)).toMatchObject({
      canCreateChild: false,
      error: { code: "NOT_DIRECTORY" },
    });
    expect(canKonquerorAcceptFileDrop(linked.state, linkId)).toBe(false);
    expect(canKonquerorDragResource(linked.state, linkId)).toBe(true);
  });
});
