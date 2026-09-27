import { describe, expect, it } from "vitest";
import {
  initialKonquerorConfirmationState,
  initialKonquerorFileOperationState,
  konquerorConfirmationReducer,
  konquerorFileOperationReducer,
} from "./fileOperationState";

describe("Konqueror file operation state", () => {
  it("tracks one Move to Trash confirmation and clears errors on close", () => {
    const opened = konquerorConfirmationReducer(initialKonquerorConfirmationState, {
      type: "open-move-to-trash",
      targetNodeIds: ["vfs-project", "vfs-branch", "vfs-branch-file", "vfs-project-file", "vfs-project-sibling"],
      operationRootNodeIds: ["vfs-project"],
      targetLabel: "5 selected items",
    });
    const errored = konquerorConfirmationReducer(opened, {
      type: "set-error",
      error: {
        code: "ALREADY_IN_TRASH",
        message: "Already in Trash.",
      },
    });
    const closed = konquerorConfirmationReducer(errored, { type: "close" });

    expect(opened).toEqual({
      kind: "move-to-trash",
      targetNodeIds: ["vfs-project", "vfs-branch", "vfs-branch-file", "vfs-project-file", "vfs-project-sibling"],
      operationRootNodeIds: ["vfs-project"],
      targetLabel: "5 selected items",
      preserveClipboard: false,
      error: null,
    });
    expect(errored).toMatchObject({ kind: "move-to-trash", error: { code: "ALREADY_IN_TRASH" } });
    expect(closed).toEqual({ kind: "closed" });
  });

  it("stores one operation status or error", () => {
    const status = konquerorFileOperationReducer(initialKonquerorFileOperationState, {
      type: "set-status",
      statusMessage: "Copied: Notes.txt",
    });
    const error = konquerorFileOperationReducer(status, {
      type: "set-error",
      error: {
        code: "ALREADY_EXISTS",
        message: "Already exists.",
      },
      errorContext: "move-to-trash",
    });
    const cleared = konquerorFileOperationReducer(error, { type: "clear" });

    expect(status).toEqual({ error: null, errorContext: null, statusMessage: "Copied: Notes.txt", blockedLaunchMessage: null });
    expect(error).toEqual({
      error: { code: "ALREADY_EXISTS", message: "Already exists." },
      errorContext: "move-to-trash",
      statusMessage: null,
      blockedLaunchMessage: null,
    });
    expect(cleared).toEqual({ error: null, errorContext: null, statusMessage: null, blockedLaunchMessage: null });
  });

  it("stores blocked launch request prompts separately from VFS errors", () => {
    const blocked = konquerorFileOperationReducer(initialKonquerorFileOperationState, {
      type: "set-blocked-launch",
      message: "Save or discard changes before opening the requested location.",
    });

    expect(blocked).toEqual({
      error: null,
      errorContext: null,
      statusMessage: null,
      blockedLaunchMessage: "Save or discard changes before opening the requested location.",
    });
  });
});
