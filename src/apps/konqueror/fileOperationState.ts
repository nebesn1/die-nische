import type {
  KonquerorConfirmationAction,
  KonquerorConfirmationState,
  KonquerorFileOperationAction,
  KonquerorFileOperationState,
} from "./fileOperationTypes";

export const initialKonquerorConfirmationState: KonquerorConfirmationState = {
  kind: "closed",
};

export const initialKonquerorFileOperationState: KonquerorFileOperationState = {
  error: null,
  errorContext: null,
  statusMessage: null,
  blockedLaunchMessage: null,
};

export function konquerorConfirmationReducer(
  state: KonquerorConfirmationState,
  action: KonquerorConfirmationAction,
): KonquerorConfirmationState {
  switch (action.type) {
    case "open-move-to-trash":
      return {
        kind: "move-to-trash",
        targetNodeIds: action.targetNodeIds,
        operationRootNodeIds: action.operationRootNodeIds,
        targetLabel: action.targetLabel,
        preserveClipboard: action.preserveClipboard ?? false,
        error: null,
      };
    case "open-delete-permanently":
      return {
        kind: "delete-permanently",
        targetNodeIds: action.targetNodeIds,
        targetLabel: action.targetLabel,
        error: null,
      };
    case "open-empty-trash":
      return {
        kind: "empty-trash",
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
      return initialKonquerorConfirmationState;
    default:
      return state;
  }
}

export function konquerorFileOperationReducer(
  state: KonquerorFileOperationState,
  action: KonquerorFileOperationAction,
): KonquerorFileOperationState {
  switch (action.type) {
    case "set-error":
      return {
        error: action.error,
        errorContext: action.errorContext ?? null,
        statusMessage: null,
        blockedLaunchMessage: null,
      };
    case "set-status":
      return {
        error: null,
        errorContext: null,
        statusMessage: action.statusMessage,
        blockedLaunchMessage: null,
      };
    case "set-blocked-launch":
      return {
        error: null,
        errorContext: null,
        statusMessage: null,
        blockedLaunchMessage: action.message,
      };
    case "clear":
      return initialKonquerorFileOperationState;
    default:
      return state;
  }
}
