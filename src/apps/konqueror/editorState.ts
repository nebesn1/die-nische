import { getVfsUtf8ByteSize } from "../../vfs/encoding";
import type { KonquerorEditorAction, KonquerorEditorState } from "./editorTypes";

export const initialKonquerorEditorState: KonquerorEditorState = {
  kind: "closed",
};

export function isKonquerorEditorDirty(state: KonquerorEditorState): boolean {
  return state.kind === "editing" && state.draftContent !== state.originalContent;
}

export function getKonquerorEditorDraftSize(state: KonquerorEditorState): number | null {
  return state.kind === "editing" ? getVfsUtf8ByteSize(state.draftContent) : null;
}

export function konquerorEditorReducer(
  state: KonquerorEditorState,
  action: KonquerorEditorAction,
): KonquerorEditorState {
  switch (action.type) {
    case "open":
      return {
        kind: "editing",
        targetNodeId: action.targetNodeId,
        originalContent: action.content,
        draftContent: action.content,
        originalModifiedAt: action.modifiedAt,
        saveError: null,
      };

    case "set-draft-content":
      if (state.kind !== "editing") {
        return state;
      }

      return {
        ...state,
        draftContent: action.draftContent,
        saveError: null,
      };

    case "set-save-error":
      if (state.kind !== "editing") {
        return state;
      }

      return {
        ...state,
        saveError: action.error,
      };

    case "clear-save-error":
      if (state.kind !== "editing" || state.saveError === null) {
        return state;
      }

      return {
        ...state,
        saveError: null,
      };

    case "close":
      return initialKonquerorEditorState;

    default:
      return state;
  }
}
