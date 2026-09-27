import type { KonquerorCommandAction, KonquerorCommandDialogState } from "./commandTypes";

export const initialKonquerorCommandDialogState: KonquerorCommandDialogState = {
  kind: "closed",
};

export function konquerorCommandDialogReducer(
  state: KonquerorCommandDialogState,
  action: KonquerorCommandAction,
): KonquerorCommandDialogState {
  switch (action.type) {
    case "open-new-folder":
      return {
        kind: "new-folder",
        parentNodeId: action.parentNodeId,
        preserveSelection: action.preserveSelection ?? false,
        draftName: "",
        error: null,
      };

    case "open-new-text-file":
      return {
        kind: "new-text-file",
        parentNodeId: action.parentNodeId,
        draftName: "",
        error: null,
      };

    case "open-rename":
      return {
        kind: "rename",
        targetNodeId: action.targetNodeId,
        originalName: action.originalName,
        draftName: action.originalName,
        error: null,
      };

    case "set-draft-name":
      return state.kind === "closed"
        ? state
        : {
            ...state,
            draftName: action.draftName,
            error: null,
          };

    case "set-error":
      return state.kind === "closed"
        ? state
        : {
            ...state,
            error: action.error,
          };

    case "close":
      return initialKonquerorCommandDialogState;

    default:
      return state;
  }
}
