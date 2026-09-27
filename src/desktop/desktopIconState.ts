import { desktopIconDefinitions, isKnownDesktopIconId } from "./desktopIconModel";
import type { DesktopIconSelectionState } from "./desktopIconTypes";

export const initialDesktopIconSelectionState: DesktopIconSelectionState = {
  selectedIconId: null,
  selectedIconIds: [],
};

export type DesktopIconSelectionAction =
  | { type: "select"; iconId: string }
  | { type: "select-many"; iconIds: readonly string[] }
  | { type: "clear" };

export function desktopIconSelectionReducer(
  state: DesktopIconSelectionState,
  action: DesktopIconSelectionAction,
): DesktopIconSelectionState {
  switch (action.type) {
    case "select": {
      if (!isKnownDesktopIconId(action.iconId)) {
        return state;
      }

      if (state.selectedIconId === action.iconId) {
        return state;
      }

      return {
        selectedIconId: action.iconId,
        selectedIconIds: [action.iconId],
      };
    }

    case "select-many": {
      const selectedIconIds = getDesktopIconIds().filter((iconId) => action.iconIds.includes(iconId));
      if (selectedIconIds.length === 0) {
        return initialDesktopIconSelectionState;
      }

      if (state.selectedIconId === selectedIconIds[0] &&
        state.selectedIconIds.length === selectedIconIds.length &&
        state.selectedIconIds.every((iconId, index) => iconId === selectedIconIds[index])) {
        return state;
      }

      return {
        selectedIconId: selectedIconIds[0],
        selectedIconIds,
      };
    }

    case "clear": {
      if (state.selectedIconId === null && state.selectedIconIds.length === 0) {
        return state;
      }

      return initialDesktopIconSelectionState;
    }
  }
}

export function getAdjacentDesktopIconId(
  iconIds: readonly string[],
  currentIconId: string | null,
  direction: "next" | "previous",
): string | null {
  if (iconIds.length === 0) {
    return null;
  }

  const currentIndex = currentIconId ? iconIds.indexOf(currentIconId) : -1;

  if (currentIndex === -1) {
    return direction === "next" ? iconIds[0] : iconIds[iconIds.length - 1];
  }

  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + offset + iconIds.length) % iconIds.length;

  return iconIds[nextIndex];
}

export function getDesktopIconIds(): readonly string[] {
  return desktopIconDefinitions.map((definition) => definition.id);
}
