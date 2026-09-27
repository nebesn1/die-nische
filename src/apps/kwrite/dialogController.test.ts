import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, moveVfsNodeToTrash } from "../../vfs/mutations";
import {
  getKWriteDialogDirectory,
  getKWriteDialogDirectoryNavigationTarget,
  getKWriteDialogParentDirectoryId,
  getKWriteInitialDialogDirectoryId,
} from "./dialogController";
import { createKWriteOpenDialog, createKWriteSaveAsDialog, navigateKWriteDialogDirectory, selectKWriteDialogNode } from "./dialogModel";
import { createInitialKWriteDocumentState, loadKWriteDocument } from "./documentModel";
import { getKWriteTextFileSnapshot } from "./documentController";

describe("KWrite VFS dialog controller", () => {
  it("starts Untitled dialogs at Home and backing-file dialogs at the current parent", () => {
    const state = createInitialVfsState();
    const notes = getKWriteTextFileSnapshot(state, "vfs-content-e594a065214576326cb903a5");

    if (!notes) {
      throw new Error("Notes fixture missing");
    }

    expect(getKWriteInitialDialogDirectoryId(state, createInitialKWriteDocumentState())).toBe(state.specialLocations.home);
    expect(getKWriteInitialDialogDirectoryId(state, loadKWriteDocument(notes))).toBe(state.specialLocations.documents);
  });

  it("lists ordered folders and text files through public VFS queries", () => {
    const state = createInitialVfsState();
    const documents = getKWriteDialogDirectory(state, state.specialLocations.documents);
    const documentNode = state.nodesById[state.specialLocations.documents];
    if (!documentNode || documentNode.kind !== "directory") throw new Error("Documents fixture missing");

    expect(documents?.path).toBe("/home/user/Documents");
    expect(documents?.children.map((node) => node.id)).toEqual(documentNode.childIds);
    expect(getKWriteDialogParentDirectoryId(state, state.specialLocations.documents)).toBe("vfs-user");
  });

  it("keeps Trash readable for Open but does not choose it as a Save As initial directory", () => {
    const state = createInitialVfsState();
    const moved = moveVfsNodeToTrash(state, "/home/user/Documents/Notes.txt", { now: "2004-08-25T12:01:00.000Z" });

    if (!moved.ok) {
      throw new Error("Trash fixture failed");
    }

    const notes = getKWriteTextFileSnapshot(moved.state, "vfs-content-e594a065214576326cb903a5");

    if (!notes) {
      throw new Error("Trashed Notes fixture missing");
    }

    expect(getKWriteDialogDirectory(moved.state, moved.state.specialLocations.trash)?.isInsideTrash).toBe(true);
    expect(getKWriteInitialDialogDirectoryId(moved.state, loadKWriteDocument(notes))).toBe(moved.state.specialLocations.home);
  });

  it("navigates Save As directories by node id, clears selection, and supports nested Up/Home round trips", () => {
    const first = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "test", { now: "2004-08-25T12:01:00.000Z" });

    if (!first.ok) {
      throw new Error("test directory fixture failed");
    }

    const second = createVfsDirectory(first.state, "/home/user/Documents/test", "nested", { now: "2004-08-25T12:02:00.000Z" });

    if (!second.ok) {
      throw new Error("nested directory fixture failed");
    }

    const documentsTarget = getKWriteDialogDirectoryNavigationTarget(second.state, "vfs-user", "vfs-documents");
    const testTarget = documentsTarget === null
      ? null
      : getKWriteDialogDirectoryNavigationTarget(second.state, documentsTarget, first.value.id);
    const nestedTarget = testTarget === null
      ? null
      : getKWriteDialogDirectoryNavigationTarget(second.state, testTarget, second.value.id);
    const selected = selectKWriteDialogNode(createKWriteSaveAsDialog("vfs-user", "Nested.txt"), "vfs-documents", "directory");
    const documents = documentsTarget === null ? selected : navigateKWriteDialogDirectory(selected, documentsTarget);
    const test = testTarget === null ? documents : navigateKWriteDialogDirectory(documents, testTarget);
    const nested = nestedTarget === null ? test : navigateKWriteDialogDirectory(test, nestedTarget);

    if (documents.type !== "save-as" || test.type !== "save-as" || nested.type !== "save-as") {
      throw new Error("Save As navigation state changed unexpectedly");
    }

    expect(documentsTarget).toBe("vfs-documents");
    expect(testTarget).toBe(first.value.id);
    expect(nestedTarget).toBe(second.value.id);
    expect(documents).toMatchObject({ type: "save-as", directoryNodeId: "vfs-documents", selectedNodeId: null, selectedDirectoryNodeId: null });
    expect(getKWriteDialogDirectory(second.state, test.directoryNodeId)?.path).toBe("/home/user/Documents/test");
    expect(getKWriteDialogDirectory(second.state, nested.directoryNodeId)?.path).toBe("/home/user/Documents/test/nested");
    expect(getKWriteDialogParentDirectoryId(second.state, nested.directoryNodeId)).toBe(first.value.id);
    expect(getKWriteDialogDirectoryNavigationTarget(second.state, "vfs-user", "vfs-documents")).toBe("vfs-documents");
  });

  it("keeps selected files for Open while using the same directory navigation transition", () => {
    const state = createInitialVfsState();
    const selected = selectKWriteDialogNode(createKWriteOpenDialog("vfs-documents"), "vfs-content-e594a065214576326cb903a5");
    const navigated = navigateKWriteDialogDirectory(selected, "vfs-user");

    expect(selected).toMatchObject({ type: "open", selectedNodeId: "vfs-content-e594a065214576326cb903a5" });
    expect(navigated).toMatchObject({ type: "open", directoryNodeId: "vfs-user", selectedNodeId: null });
    expect(getKWriteDialogDirectoryNavigationTarget(state, "vfs-documents", "vfs-content-e594a065214576326cb903a5")).toBeNull();
  });

  it("keeps a close target through Save As directory navigation", () => {
    const dialog = createKWriteSaveAsDialog("vfs-user", "Recovered.txt", null, { type: "window", requestId: 42 });
    const navigated = navigateKWriteDialogDirectory(dialog, "vfs-documents");

    expect(navigated).toMatchObject({
      type: "save-as",
      directoryNodeId: "vfs-documents",
      selectedNodeId: null,
      selectedDirectoryNodeId: null,
      closeTarget: { type: "window", requestId: 42 },
    });
  });

  it("keeps single-clicked Save As folders separate from the displayed directory", () => {
    const selected = selectKWriteDialogNode(createKWriteSaveAsDialog("vfs-user", "Untitled.txt"), "vfs-downloads", "directory");

    expect(selected).toMatchObject({
      type: "save-as",
      directoryNodeId: "vfs-user",
      selectedNodeId: "vfs-downloads",
      selectedDirectoryNodeId: "vfs-downloads",
      filename: "Untitled.txt",
    });
  });
});
