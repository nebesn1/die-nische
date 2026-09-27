export type KonquerorContextSubmenuId = "preview-in" | "open-with" | "actions" | "create-new";

export type KonquerorContextSubmenuState = {
  readonly openSubmenuId: KonquerorContextSubmenuId | null;
  readonly pendingCloseId: KonquerorContextSubmenuId | null;
};

export type KonquerorContextSubmenuAction =
  | { readonly type: "open"; readonly submenuId: KonquerorContextSubmenuId }
  | { readonly type: "schedule-close"; readonly submenuId: KonquerorContextSubmenuId }
  | { readonly type: "cancel-close"; readonly submenuId: KonquerorContextSubmenuId }
  | { readonly type: "close-if-pending"; readonly submenuId: KonquerorContextSubmenuId }
  | { readonly type: "close-all" };

export const KONQUEROR_SUBMENU_CLOSE_GRACE_MS = 140;

export const initialKonquerorContextSubmenuState: KonquerorContextSubmenuState = {
  openSubmenuId: null,
  pendingCloseId: null,
};

export function konquerorContextSubmenuReducer(
  state: KonquerorContextSubmenuState,
  action: KonquerorContextSubmenuAction,
): KonquerorContextSubmenuState {
  switch (action.type) {
    case "open":
      return state.openSubmenuId === action.submenuId && state.pendingCloseId === null
        ? state
        : { openSubmenuId: action.submenuId, pendingCloseId: null };
    case "schedule-close":
      return state.openSubmenuId === action.submenuId && state.pendingCloseId !== action.submenuId
        ? { ...state, pendingCloseId: action.submenuId }
        : state;
    case "cancel-close":
      return state.pendingCloseId === action.submenuId ? { ...state, pendingCloseId: null } : state;
    case "close-if-pending":
      return state.openSubmenuId === action.submenuId && state.pendingCloseId === action.submenuId
        ? initialKonquerorContextSubmenuState
        : state;
    case "close-all":
      return state.openSubmenuId === null && state.pendingCloseId === null ? state : initialKonquerorContextSubmenuState;
  }
}
