import type { KonquerorApplicationMenuSubmenuId } from "./applicationMenuModel";

export type KonquerorApplicationMenuSubmenuState = {
  readonly openSubmenuId: KonquerorApplicationMenuSubmenuId | null;
  readonly pendingCloseId: KonquerorApplicationMenuSubmenuId | null;
};

export type KonquerorApplicationMenuSubmenuAction =
  | { readonly type: "open"; readonly submenuId: KonquerorApplicationMenuSubmenuId }
  | { readonly type: "schedule-close"; readonly submenuId: KonquerorApplicationMenuSubmenuId }
  | { readonly type: "cancel-close"; readonly submenuId: KonquerorApplicationMenuSubmenuId }
  | { readonly type: "close-if-pending"; readonly submenuId: KonquerorApplicationMenuSubmenuId }
  | { readonly type: "close-all" };

export const KONQUEROR_APPLICATION_MENU_SUBMENU_CLOSE_GRACE_MS = 140;

export const initialKonquerorApplicationMenuSubmenuState: KonquerorApplicationMenuSubmenuState = {
  openSubmenuId: null,
  pendingCloseId: null,
};

export function konquerorApplicationMenuSubmenuReducer(
  state: KonquerorApplicationMenuSubmenuState,
  action: KonquerorApplicationMenuSubmenuAction,
): KonquerorApplicationMenuSubmenuState {
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
        ? initialKonquerorApplicationMenuSubmenuState
        : state;
    case "close-all":
      return state.openSubmenuId === null && state.pendingCloseId === null ? state : initialKonquerorApplicationMenuSubmenuState;
  }
}
