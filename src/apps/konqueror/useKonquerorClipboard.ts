import { useContext } from "react";
import { KonquerorClipboardContext, type KonquerorClipboardContextValue } from "./konquerorClipboardContext";

export function useOptionalKonquerorClipboard(): KonquerorClipboardContextValue | null {
  return useContext(KonquerorClipboardContext);
}
