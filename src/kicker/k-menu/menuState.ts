import { kMenuEntries } from "./menuModel";
import type { KMenuEntry, KMenuState } from "./types";

export const initialKMenuState: KMenuState = {
  isOpen: false,
  activeItemId: null,
  openSubmenuId: null,
};

export type KMenuAction =
  | { type: "open"; activeItemId?: string | null }
  | { type: "close" }
  | { type: "toggle"; activeItemId?: string | null }
  | { type: "set-active-item"; itemId: string | null }
  | { type: "open-submenu"; submenuId: string; enabled?: boolean }
  | { type: "close-submenu" };

const isEnabledMenuEntry = (entry: KMenuEntry | undefined): boolean => {
  return entry !== undefined && entry.type !== "separator" && entry.type !== "section" && entry.enabled;
};

export function getEnabledItemIds(entries: readonly KMenuEntry[]): readonly string[] {
  return entries.filter(isEnabledMenuEntry).map((entry) => entry.id);
}

export function getFirstEnabledItemId(entries: readonly KMenuEntry[] = kMenuEntries): string | null {
  return getEnabledItemIds(entries)[0] ?? null;
}

export function getLastEnabledItemId(entries: readonly KMenuEntry[] = kMenuEntries): string | null {
  const enabledIds = getEnabledItemIds(entries);

  return enabledIds[enabledIds.length - 1] ?? null;
}

export function getNextEnabledItemId(
  entries: readonly KMenuEntry[],
  currentItemId: string | null,
  direction: "next" | "previous",
): string | null {
  const enabledIds = getEnabledItemIds(entries);

  if (enabledIds.length === 0) {
    return null;
  }

  const currentIndex = currentItemId ? enabledIds.indexOf(currentItemId) : -1;

  if (currentIndex === -1) {
    return direction === "next" ? enabledIds[0] : enabledIds[enabledIds.length - 1];
  }

  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + offset + enabledIds.length) % enabledIds.length;

  return enabledIds[nextIndex];
}

export function kMenuReducer(state: KMenuState, action: KMenuAction): KMenuState {
  switch (action.type) {
    case "open": {
      return {
        isOpen: true,
        activeItemId: action.activeItemId ?? null,
        openSubmenuId: null,
      };
    }

    case "close": {
      return initialKMenuState;
    }

    case "toggle": {
      if (state.isOpen) {
        return initialKMenuState;
      }

      return {
        isOpen: true,
        activeItemId: action.activeItemId ?? null,
        openSubmenuId: null,
      };
    }

    case "set-active-item": {
      return {
        ...state,
        activeItemId: action.itemId,
      };
    }

    case "open-submenu": {
      if (action.enabled === false) {
        return state;
      }

      if (action.enabled === undefined && !kMenuEntries.some((entry) => entry.type === "submenu" && entry.id === action.submenuId)) {
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
