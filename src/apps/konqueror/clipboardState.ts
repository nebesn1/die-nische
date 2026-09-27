import type { KonquerorClipboardAction, KonquerorClipboardEntry, KonquerorClipboardState } from "./clipboardTypes";
import { normalizeKonquerorSelection } from "./selectionModel";

export const initialKonquerorClipboardState: KonquerorClipboardState = {
  kind: "empty",
};

export function konquerorClipboardReducer(
  state: KonquerorClipboardState,
  action: KonquerorClipboardAction,
): KonquerorClipboardState {
  switch (action.type) {
    case "copy":
      return {
        kind: "items",
        mode: "copy",
        entries: normalizeEntries(action.entries),
        displayNodeIds: normalizeKonquerorSelection(action.displayNodeIds),
      };
    case "cut":
      return {
        kind: "items",
        mode: "cut",
        entries: normalizeEntries(action.entries),
        displayNodeIds: normalizeKonquerorSelection(action.displayNodeIds),
      };
    case "clear":
      return initialKonquerorClipboardState;
    default:
      return state;
  }
}

function normalizeEntries(entries: readonly KonquerorClipboardEntry[]): readonly KonquerorClipboardEntry[] {
  const seen = new Set<KonquerorClipboardEntry["nodeId"]>();
  return entries.filter((entry) => {
    if (seen.has(entry.nodeId)) {
      return false;
    }

    seen.add(entry.nodeId);
    return true;
  });
}
