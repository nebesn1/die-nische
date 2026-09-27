import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { useVfs } from "../../vfs/useVfs";
import {
  initialKonquerorFileUndoState,
  konquerorFileUndoReducer,
  type KonquerorFileUndoRecord,
} from "./fileUndoHistory";
import { KonquerorFileUndoContext } from "./konquerorFileUndoContext";

/** Desktop-session-owned VFS undo history shared by every Konqueror window. */
export function KonquerorFileUndoProvider({ children }: { readonly children: ReactNode }) {
  const vfs = useVfs();
  const desktopSession = useOptionalDesktopSession();
  const [state, dispatch] = useReducer(konquerorFileUndoReducer, initialKonquerorFileUndoState);
  const stateRef = useRef(state);
  const nextId = useRef(1);
  stateRef.current = state;

  useEffect(() => {
    if ((desktopSession?.resetGeneration ?? 0) > 0) {
      stateRef.current = initialKonquerorFileUndoState;
      dispatch({ type: "clear" });
    }
  }, [desktopSession?.resetGeneration]);

  const record = useCallback((entry: KonquerorFileUndoRecord["entry"]) => {
    const record: KonquerorFileUndoRecord = { id: `konqueror-file-undo-${nextId.current++}`, entry };
    const next = { entries: [...stateRef.current.entries, record], isExecuting: false };
    stateRef.current = next;
    dispatch({ type: "record", record });
  }, []);

  const undo = useCallback((now: string) => {
    const current = stateRef.current;
    const record = current.entries.at(-1);
    if (!record || current.isExecuting) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "No file operation is available to undo." } };
    }
    stateRef.current = { ...current, isExecuting: true };
    dispatch({ type: "begin" });
    const result = vfs.undoFileOperation(record.entry, { now });
    if (result.ok) {
      stateRef.current = { entries: current.entries.slice(0, -1), isExecuting: false };
      dispatch({ type: "complete", id: record.id });
    } else {
      stateRef.current = { ...current, isExecuting: false };
      dispatch({ type: "failed" });
    }
    return result;
  }, [vfs]);

  const value = useMemo(() => ({ state, dispatch, record, undo }), [record, state, undo]);
  return <KonquerorFileUndoContext.Provider value={value}>{children}</KonquerorFileUndoContext.Provider>;
}
