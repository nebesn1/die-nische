import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsTextFile, moveVfsNodeToTrash } from "../../vfs/mutations";
import type { VfsState } from "../../vfs/types";
import { getKonquerorClipboardAvailability } from "./clipboardAvailability";
import type { KonquerorClipboardState } from "./clipboardTypes";
import { createInitialKonquerorNavigationState } from "./navigationState";
import { getKonquerorView } from "./navigationController";

const clipboard: KonquerorClipboardState = {
  kind: "items",
  mode: "copy",
  entries: [{ nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: "vfs-documents" }],
  displayNodeIds: ["vfs-content-e594a065214576326cb903a5"],
};

const getView = (state: VfsState, nodeId: string) =>
  getKonquerorView(state, createInitialKonquerorNavigationState(nodeId, "/fixture"));

const getAvailability = (
  state: VfsState,
  selectedNodeIds: readonly string[],
  options: Partial<{
    nodeId: string;
    clipboardState: KonquerorClipboardState;
    isEditing: boolean;
    isCommandDialogOpen: boolean;
    isConfirmationOpen: boolean;
    isPropertiesOpen: boolean;
  }> = {},
) =>
  (() => {
    const view = getView(state, options.nodeId ?? state.specialLocations.documents);
    return getKonquerorClipboardAvailability({
      state,
      view,
    selectedNodeIds,
      visibleNodeIds: view.type === "directory" ? view.children.map((node) => node.id) : [],
    clipboardState: options.clipboardState ?? { kind: "empty" },
    isEditing: options.isEditing ?? false,
    isCommandDialogOpen: options.isCommandDialogOpen ?? false,
    isConfirmationOpen: options.isConfirmationOpen ?? false,
    isPropertiesOpen: options.isPropertiesOpen ?? false,
    });
  })();

describe("Konqueror clipboard command availability", () => {
  it("enables copy, cut, paste, and move to trash in a normal selected directory view", () => {
    const state = createInitialVfsState();

    expect(getAvailability(state, ["vfs-content-e594a065214576326cb903a5"], { clipboardState: clipboard })).toMatchObject({
      canCopy: true,
      canCut: true,
      canPaste: true,
      canMoveToTrash: true,
      canOpenTrash: true,
      isTrashView: false,
    });
  });

  it("disables commands without selection or on protected nodes", () => {
    const state = createInitialVfsState();

    expect(getAvailability(state, [])).toMatchObject({
      canCopy: false,
      canCut: false,
      canMoveToTrash: false,
    });
    expect(getAvailability(state, [state.specialLocations.documents], { nodeId: state.specialLocations.home })).toMatchObject({
      canCopy: true,
      canCut: false,
      canMoveToTrash: false,
    });
  });

  it("disables file clipboard commands in file view, editing, dialogs, and Trash", () => {
    const state = createInitialVfsState();
    const trashed = moveVfsNodeToTrash(state, "/home/user/Documents/Notes.txt", {
      now: "2026-08-03T00:00:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("trash fixture failed");
    }

    expect(getAvailability(state, ["vfs-content-e594a065214576326cb903a5"], { nodeId: "vfs-content-e594a065214576326cb903a5", clipboardState: clipboard })).toMatchObject({
      canCopy: false,
      canCut: false,
    });
    expect(getAvailability(state, ["vfs-content-e594a065214576326cb903a5"], { clipboardState: clipboard, isEditing: true })).toMatchObject({
      canCopy: false,
      canCut: false,
      canPaste: false,
      canMoveToTrash: false,
      canOpenTrash: false,
    });
    expect(getAvailability(state, ["vfs-content-e594a065214576326cb903a5"], { clipboardState: clipboard, isCommandDialogOpen: true })).toMatchObject({
      canCopy: false,
      canPaste: false,
    });
    expect(getAvailability(state, ["vfs-content-e594a065214576326cb903a5"], { clipboardState: clipboard, isPropertiesOpen: true })).toMatchObject({
      canCopy: false,
      canCut: false,
      canPaste: false,
      canMoveToTrash: false,
    });
    expect(getAvailability(trashed.state, ["vfs-content-e594a065214576326cb903a5"], { nodeId: trashed.state.specialLocations.trash, clipboardState: clipboard })).toMatchObject({
      isTrashView: true,
      canCopy: false,
      canCut: false,
      canPaste: false,
      canMoveToTrash: false,
    });
  });

  it("enables batch-capable clipboard operations for eligible multi-selection without choosing an arbitrary node", () => {
    const state = createInitialVfsState();

    expect(getAvailability(state, ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], { clipboardState: clipboard })).toMatchObject({
      canCopy: true,
      canCut: true,
      canMoveToTrash: true,
      selectedNode: null,
      selectedNodes: [expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }), expect.objectContaining({ id: "vfs-content-76cff3ce17d8a853403179f1" })],
      copyTitle: "Copy",
    });
  });

  it("allows same-parent and cross-parent Tree selections without choosing a first parent", () => {
    const created = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", {
      now: "2026-08-30T00:00:00.000Z",
    });
    if (!created.ok) throw new Error("Picture fixture failed");
    const state = created.state;
    const visibleNodeIds = ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1", created.value.id];
    const view = getView(state, state.specialLocations.home);

    expect(getKonquerorClipboardAvailability({
      state,
      view,
      selectedNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
      visibleNodeIds,
      clipboardState: { kind: "empty" },
      isEditing: false,
      isCommandDialogOpen: false,
      isConfirmationOpen: false,
    })).toMatchObject({
      canCopy: true,
      canCut: true,
      selectedNodes: [expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }), expect.objectContaining({ id: "vfs-content-76cff3ce17d8a853403179f1" })],
    });

    expect(getKonquerorClipboardAvailability({
      state,
      view,
      selectedNodeIds: ["vfs-content-e594a065214576326cb903a5", created.value.id],
      visibleNodeIds,
      clipboardState: { kind: "empty" },
      isEditing: false,
      isCommandDialogOpen: false,
      isConfirmationOpen: false,
    })).toMatchObject({
      canCopy: true,
      canCut: true,
      canMoveToTrash: true,
      selectedNodes: [expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }), expect.objectContaining({ id: created.value.id })],
    });
  });
});
