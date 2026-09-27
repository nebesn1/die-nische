import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import {
  getKonquerorEditorDraftSize,
  initialKonquerorEditorState,
  isKonquerorEditorDirty,
  konquerorEditorReducer,
} from "./editorState";

describe("Konqueror editor state", () => {
  it("starts closed", () => {
    expect(initialKonquerorEditorState).toEqual({ kind: "closed" });
    expect(isKonquerorEditorDirty(initialKonquerorEditorState)).toBe(false);
    expect(getKonquerorEditorDraftSize(initialKonquerorEditorState)).toBeNull();
  });

  it("opens against a stable node id with the current file content", () => {
    const state = createInitialVfsState();
    const file = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

    if (file.kind !== "file" || file.content.kind !== "text") {
      throw new Error("fixture file missing");
    }

    const editor = konquerorEditorReducer(initialKonquerorEditorState, {
      type: "open",
      targetNodeId: file.id,
      content: file.content.text,
      modifiedAt: file.modifiedAt,
    });

    expect(editor).toMatchObject({
      kind: "editing",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalContent: file.content.text,
      draftContent: file.content.text,
      originalModifiedAt: file.modifiedAt,
      saveError: null,
    });
    expect(isKonquerorEditorDirty(editor)).toBe(false);
  });

  it("tracks dirty state by exact draft content without trimming", () => {
    const opened = konquerorEditorReducer(initialKonquerorEditorState, {
      type: "open",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      content: "Hello",
      modifiedAt: "2004-08-25T12:00:00.000Z",
    });
    const changed = konquerorEditorReducer(opened, {
      type: "set-draft-content",
      draftContent: " Hello ",
    });
    const cleanAgain = konquerorEditorReducer(changed, {
      type: "set-draft-content",
      draftContent: "Hello",
    });

    expect(isKonquerorEditorDirty(changed)).toBe(true);
    expect(isKonquerorEditorDirty(cleanAgain)).toBe(false);
    expect(getKonquerorEditorDraftSize(changed)).toBe(7);
  });

  it("clears old save errors when the draft changes", () => {
    const opened = konquerorEditorReducer(initialKonquerorEditorState, {
      type: "open",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      content: "Hello",
      modifiedAt: "2004-08-25T12:00:00.000Z",
    });
    const failed = konquerorEditorReducer(opened, {
      type: "set-save-error",
      error: {
        code: "NOT_FOUND",
        message: "Missing",
      },
    });
    const changed = konquerorEditorReducer(failed, {
      type: "set-draft-content",
      draftContent: "Changed",
    });

    expect(failed.kind === "editing" ? failed.saveError?.code : null).toBe("NOT_FOUND");
    expect(changed.kind === "editing" ? changed.saveError : "not-editing").toBeNull();
  });

  it("supports explicit error clearing and discard close without mutating old state", () => {
    const opened = konquerorEditorReducer(initialKonquerorEditorState, {
      type: "open",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      content: "Hello",
      modifiedAt: "2004-08-25T12:00:00.000Z",
    });
    const failed = konquerorEditorReducer(opened, {
      type: "set-save-error",
      error: {
        code: "NOT_FOUND",
        message: "Missing",
      },
    });
    const cleared = konquerorEditorReducer(failed, { type: "clear-save-error" });
    const closed = konquerorEditorReducer(cleared, { type: "close" });

    expect(failed).not.toBe(cleared);
    expect(failed.kind === "editing" ? failed.saveError?.code : null).toBe("NOT_FOUND");
    expect(cleared.kind === "editing" ? cleared.saveError : "not-editing").toBeNull();
    expect(closed).toEqual({ kind: "closed" });
  });
});
