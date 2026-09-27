import { describe, expect, it } from "vitest";
import {
  initialKonquerorBookmarkFolderDialogState,
  konquerorBookmarkFolderDialogReducer,
} from "./bookmarkFolderDialogState";

describe("Konqueror bookmark Folder dialog state", () => {
  it("captures the stable parent and all-tab bookmark drafts at command invocation", () => {
    const drafts = [
      { name: "Home", location: "/home/user" },
      { name: "Example", location: "https://example.com" },
    ] as const;
    const opened = konquerorBookmarkFolderDialogReducer(initialKonquerorBookmarkFolderDialogState, {
      type: "open-bookmark-tabs-as-folder",
      parentFolderId: "folder-work",
      bookmarkDraftsSnapshot: drafts,
    });
    const named = konquerorBookmarkFolderDialogReducer(opened, { type: "set-draft-name", draftName: "Session" });

    expect(named).toEqual({
      kind: "open",
      intent: "bookmark-tabs-as-folder",
      parentFolderId: "folder-work",
      bookmarkDraftsSnapshot: drafts,
      draftName: "Session",
      error: null,
    });
  });
});
