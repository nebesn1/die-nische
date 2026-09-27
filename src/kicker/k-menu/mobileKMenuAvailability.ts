import type { WindowLayoutMode } from "../../window-manager/types";
import type { KMenuEntry } from "./types";

const mobileUnsupportedApplicationIds = ["configure-panel", "kcalc", "kfind"] as const;
const mobileUnsupportedSubmenuIds = ["action-bookmarks", "action-quick-browser"] as const;
const mobileUnsupportedCommandIds = ["run-command"] as const;

const includes = <T extends string>(values: readonly T[], value: string): boolean => values.includes(value as T);

export function isKMenuEntryAvailableInLayout(entry: KMenuEntry, layoutMode: WindowLayoutMode): boolean {
  if (layoutMode === "desktop" || entry.type === "section" || entry.type === "separator") {
    return true;
  }

  if (entry.type === "application") {
    return !includes(mobileUnsupportedApplicationIds, entry.appId);
  }

  if (entry.type === "submenu") {
    return !includes(mobileUnsupportedSubmenuIds, entry.id);
  }

  return !includes(mobileUnsupportedCommandIds, entry.commandId);
}

/** Applies the mobile product policy without changing the menu's ordering or identity. */
export function applyKMenuAvailability(
  entries: readonly KMenuEntry[],
  layoutMode: WindowLayoutMode,
): readonly KMenuEntry[] {
  return entries.map((entry) => {
    if (entry.type === "section" || entry.type === "separator") {
      return entry;
    }

    const enabled = entry.enabled && isKMenuEntryAvailableInLayout(entry, layoutMode);

    if (entry.type === "submenu") {
      return {
        ...entry,
        enabled,
        children: applyKMenuAvailability(entry.children, layoutMode),
      };
    }

    return { ...entry, enabled };
  });
}
