import { describe, expect, it } from "vitest";
import type { VfsError } from "../../vfs/errors";
import { initialKonquerorCommandDialogState, konquerorCommandDialogReducer } from "./commandState";

const error: VfsError = {
  code: "INVALID_NAME",
  message: "Invalid",
};

describe("Konqueror command dialog state", () => {
  it("starts closed", () => {
    expect(initialKonquerorCommandDialogState).toEqual({ kind: "closed" });
  });

  it("opens New Folder with parent node id", () => {
    expect(
      konquerorCommandDialogReducer(initialKonquerorCommandDialogState, {
        type: "open-new-folder",
        parentNodeId: "vfs-documents",
      }),
    ).toEqual({
      kind: "new-folder",
      parentNodeId: "vfs-documents",
      preserveSelection: false,
      draftName: "",
      error: null,
    });
  });

  it("records explicit folder-item creation without changing the dialog target", () => {
    expect(
      konquerorCommandDialogReducer(initialKonquerorCommandDialogState, {
        type: "open-new-folder",
        parentNodeId: "vfs-documents",
        preserveSelection: true,
      }),
    ).toMatchObject({
      kind: "new-folder",
      parentNodeId: "vfs-documents",
      preserveSelection: true,
      draftName: "",
    });
  });

  it("opens New Text File with parent node id", () => {
    expect(
      konquerorCommandDialogReducer(initialKonquerorCommandDialogState, {
        type: "open-new-text-file",
        parentNodeId: "vfs-documents",
      }),
    ).toEqual({
      kind: "new-text-file",
      parentNodeId: "vfs-documents",
      draftName: "",
      error: null,
    });
  });

  it("opens Rename with target id and original name", () => {
    expect(
      konquerorCommandDialogReducer(initialKonquerorCommandDialogState, {
        type: "open-rename",
        targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
        originalName: "Welcome.md",
      }),
    ).toEqual({
      kind: "rename",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalName: "Welcome.md",
      draftName: "Welcome.md",
      error: null,
    });
  });

  it("updates draft and clears old error", () => {
    const opened = konquerorCommandDialogReducer(initialKonquerorCommandDialogState, {
      type: "open-new-folder",
      parentNodeId: "vfs-documents",
    });
    const withError = konquerorCommandDialogReducer(opened, { type: "set-error", error });
    const changed = konquerorCommandDialogReducer(withError, { type: "set-draft-name", draftName: "Projects" });

    expect(withError.kind !== "closed" ? withError.error : null).toBe(error);
    expect(changed).toMatchObject({ draftName: "Projects", error: null });
  });

  it("closes and allows only one dialog at a time", () => {
    const folder = konquerorCommandDialogReducer(initialKonquerorCommandDialogState, {
      type: "open-new-folder",
      parentNodeId: "vfs-documents",
    });
    const rename = konquerorCommandDialogReducer(folder, {
      type: "open-rename",
      targetNodeId: "vfs-content-e594a065214576326cb903a5",
      originalName: "Notes.txt",
    });

    expect(rename.kind).toBe("rename");
    expect(konquerorCommandDialogReducer(rename, { type: "close" })).toEqual({ kind: "closed" });
  });
});
