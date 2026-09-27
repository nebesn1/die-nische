import type {
  KonquerorDirectTransferDialogAction,
  KonquerorDirectTransferDialogState,
} from "./directTransferTypes";

export const initialKonquerorDirectTransferDialogState: KonquerorDirectTransferDialogState = {
  kind: "closed",
};

export function konquerorDirectTransferDialogReducer(
  state: KonquerorDirectTransferDialogState,
  action: KonquerorDirectTransferDialogAction,
): KonquerorDirectTransferDialogState {
  switch (action.type) {
    case "open":
      return {
        kind: "open",
        request: action.request,
        destinationDraft: action.destinationDraft,
        error: null,
      };
    case "set-destination-draft":
      return state.kind === "closed"
        ? state
        : { ...state, destinationDraft: action.destinationDraft, error: null };
    case "set-error":
      return state.kind === "closed" ? state : { ...state, error: action.error };
    case "close":
      return initialKonquerorDirectTransferDialogState;
    default:
      return state;
  }
}
