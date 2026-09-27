import type { KonquerorBookmarkFolderId } from "./bookmarks";
import type { KonquerorBookmarkDraft } from "./bookmarks";

export type KonquerorBookmarkFolderDialogState =
  | { readonly kind: "closed" }
  | {
      readonly kind: "open";
      readonly intent: "new-folder" | "bookmark-tabs-as-folder";
      readonly parentFolderId: KonquerorBookmarkFolderId | null;
      /** Snapshot at menu invocation; submit must not read another window's current tabs. */
      readonly bookmarkDraftsSnapshot: readonly KonquerorBookmarkDraft[];
      readonly draftName: string;
      readonly error: "invalid-name" | "parent-unavailable" | "no-bookmarkable-tabs" | null;
    };

export type KonquerorBookmarkFolderDialogAction =
  | { readonly type: "open"; readonly parentFolderId: KonquerorBookmarkFolderId | null }
  | {
      readonly type: "open-bookmark-tabs-as-folder";
      readonly parentFolderId: KonquerorBookmarkFolderId | null;
      readonly bookmarkDraftsSnapshot: readonly KonquerorBookmarkDraft[];
    }
  | { readonly type: "set-draft-name"; readonly draftName: string }
  | { readonly type: "set-error"; readonly error: "invalid-name" | "parent-unavailable" | "no-bookmarkable-tabs" }
  | { readonly type: "close" };

export const initialKonquerorBookmarkFolderDialogState: KonquerorBookmarkFolderDialogState = { kind: "closed" };

export function konquerorBookmarkFolderDialogReducer(
  state: KonquerorBookmarkFolderDialogState,
  action: KonquerorBookmarkFolderDialogAction,
): KonquerorBookmarkFolderDialogState {
  switch (action.type) {
    case "open":
      return { kind: "open", intent: "new-folder", parentFolderId: action.parentFolderId, bookmarkDraftsSnapshot: [], draftName: "", error: null };
    case "open-bookmark-tabs-as-folder":
      return {
        kind: "open",
        intent: "bookmark-tabs-as-folder",
        parentFolderId: action.parentFolderId,
        bookmarkDraftsSnapshot: action.bookmarkDraftsSnapshot,
        draftName: "",
        error: null,
      };
    case "set-draft-name":
      return state.kind === "closed" ? state : { ...state, draftName: action.draftName, error: null };
    case "set-error":
      return state.kind === "closed" ? state : { ...state, error: action.error };
    case "close":
      return initialKonquerorBookmarkFolderDialogState;
  }
}
