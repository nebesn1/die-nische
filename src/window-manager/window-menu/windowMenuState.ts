import type { WindowMenuEntry, WindowMenuState } from "./types";

export const initialWindowMenuState: WindowMenuState = {
  openWindowId: null,
  openSubmenuId: null,
  activeItemId: null,
  anchor: null,
};

export type WindowMenuAction =
  | { type: "open"; windowId: string; anchor: WindowMenuState["anchor"]; activeItemId: string | null }
  | { type: "close" }
  | { type: "set-active-item"; itemId: string | null }
  | { type: "open-submenu"; submenuId: string }
  | { type: "close-submenu" };

const isEnabledMenuEntry = (entry: WindowMenuEntry): boolean => {
  return entry.type !== "separator" && entry.enabled;
};

export function getEnabledWindowMenuItemIds(entries: readonly WindowMenuEntry[]): readonly string[] {
  return entries.filter(isEnabledMenuEntry).map((entry) => entry.id);
}

export function getFirstEnabledWindowMenuItemId(entries: readonly WindowMenuEntry[]): string | null {
  return getEnabledWindowMenuItemIds(entries)[0] ?? null;
}

export function getLastEnabledWindowMenuItemId(entries: readonly WindowMenuEntry[]): string | null {
  const ids = getEnabledWindowMenuItemIds(entries);

  return ids[ids.length - 1] ?? null;
}

export function getNextEnabledWindowMenuItemId(
  entries: readonly WindowMenuEntry[],
  currentItemId: string | null,
  direction: "next" | "previous",
): string | null {
  const ids = getEnabledWindowMenuItemIds(entries);

  if (ids.length === 0) {
    return null;
  }

  const currentIndex = currentItemId ? ids.indexOf(currentItemId) : -1;

  if (currentIndex === -1) {
    return direction === "next" ? ids[0] : ids[ids.length - 1];
  }

  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + offset + ids.length) % ids.length;

  return ids[nextIndex];
}

export function windowMenuReducer(state: WindowMenuState, action: WindowMenuAction): WindowMenuState {
  switch (action.type) {
    case "open": {
      return {
        openWindowId: action.windowId,
        openSubmenuId: null,
        activeItemId: action.activeItemId,
        anchor: action.anchor,
      };
    }

    case "close": {
      return initialWindowMenuState;
    }

    case "set-active-item": {
      return {
        ...state,
        activeItemId: action.itemId,
      };
    }

    case "open-submenu": {
      if (action.submenuId !== "to-desktop") {
        return state;
      }

      return {
        ...state,
        openSubmenuId: action.submenuId,
      };
    }

    case "close-submenu": {
      return {
        ...state,
        openSubmenuId: null,
      };
    }
  }
}
