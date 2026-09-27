import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { moveVfsNodeToTrash } from "../../vfs/mutations";
import { getKonquerorView } from "./navigationController";
import { createInitialKonquerorNavigationState } from "./navigationState";
import { getKonquerorTrashCommandAvailability } from "./trashCommandAvailability";

const now = "2026-08-03T00:00:00.000Z";

describe("Konqueror Trash command availability", () => {
  it("enables Restore and Delete Permanently only for direct Trash entries", () => {
    const trashed = moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now });

    if (!trashed.ok) {
      throw new Error("trash fixture failed");
    }

    const view = getKonquerorView(
      trashed.state,
      createInitialKonquerorNavigationState(trashed.state.specialLocations.trash, "/home/user/.local/share/Trash/files"),
    );

    expect(
      getKonquerorTrashCommandAvailability({
        state: trashed.state,
        view,
        selectedNodeIds: ["vfs-content-e594a065214576326cb903a5"],
        visibleNodeIds: view.type === "directory" ? view.children.map((node) => node.id) : [],
        isBlocking: false,
      }),
    ).toMatchObject({
      canRestore: true,
      canDeletePermanently: true,
      canEmptyTrash: true,
      selectedTrashEntryNodeId: "vfs-content-e594a065214576326cb903a5",
      selectedTrashEntryName: "Notes.txt",
    });
  });

  it("disables Trash actions outside Trash root or while blocking", () => {
    const state = createInitialVfsState();
    const homeView = getKonquerorView(state, createInitialKonquerorNavigationState(state.specialLocations.home, "/home/user"));
    const trashView = getKonquerorView(state, createInitialKonquerorNavigationState(state.specialLocations.trash, "/home/user/.local/share/Trash/files"));

    expect(
      getKonquerorTrashCommandAvailability({
        state,
        view: homeView,
        selectedNodeIds: [state.specialLocations.documents],
        visibleNodeIds: homeView.type === "directory" ? homeView.children.map((node) => node.id) : [],
        isBlocking: false,
      }),
    ).toMatchObject({ canRestore: false, canDeletePermanently: false, canEmptyTrash: false });
    expect(
      getKonquerorTrashCommandAvailability({
        state,
        view: trashView,
        selectedNodeIds: [],
        visibleNodeIds: trashView.type === "directory" ? trashView.children.map((node) => node.id) : [],
        isBlocking: true,
      }),
    ).toMatchObject({ canRestore: false, canDeletePermanently: false, canEmptyTrash: false });
  });

  it("enables Restore and Delete Permanently for eligible multi-selection only", () => {
    const trashed = moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now });

    if (!trashed.ok) throw new Error("trash fixture failed");

    const view = getKonquerorView(
      trashed.state,
      createInitialKonquerorNavigationState(trashed.state.specialLocations.trash, "/home/user/.local/share/Trash/files"),
    );
    const availability = getKonquerorTrashCommandAvailability({
      state: trashed.state,
      view,
      selectedNodeIds: ["vfs-content-e594a065214576326cb903a5", trashed.state.specialLocations.documents],
      visibleNodeIds: view.type === "directory" ? view.children.map((node) => node.id) : [],
      isBlocking: false,
    });

    expect(availability.canRestore).toBe(false);
    expect(availability.canDeletePermanently).toBe(false);
    expect(availability.selectedTrashEntryNodeId).toBeNull();
  });
});
