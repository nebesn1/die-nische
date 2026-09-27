import { useContext } from "react";
import { KonquerorFileUndoContext, type KonquerorFileUndoContextValue } from "./konquerorFileUndoContext";

export function useOptionalKonquerorFileUndo(): KonquerorFileUndoContextValue | null {
  return useContext(KonquerorFileUndoContext);
}
