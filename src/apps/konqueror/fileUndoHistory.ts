import type { VfsFileOperationUndoEntry } from "../../vfs/fileOperationUndo";

export type KonquerorFileUndoRecord = {
  readonly id: string;
  readonly entry: VfsFileOperationUndoEntry;
};

export type KonquerorFileUndoState = {
  readonly entries: readonly KonquerorFileUndoRecord[];
  readonly isExecuting: boolean;
};

export const initialKonquerorFileUndoState: KonquerorFileUndoState = {
  entries: [],
  isExecuting: false,
};

export type KonquerorFileUndoAction =
  | { readonly type: "record"; readonly record: KonquerorFileUndoRecord }
  | { readonly type: "begin" }
  | { readonly type: "complete"; readonly id: string }
  | { readonly type: "failed" }
  | { readonly type: "clear" };

/** LIFO file-operation history. Undo completion is the only transition that pops an entry. */
export function konquerorFileUndoReducer(
  state: KonquerorFileUndoState,
  action: KonquerorFileUndoAction,
): KonquerorFileUndoState {
  switch (action.type) {
    case "record":
      return { entries: [...state.entries, action.record], isExecuting: false };
    case "begin":
      return state.entries.length === 0 || state.isExecuting ? state : { ...state, isExecuting: true };
    case "complete":
      if (state.entries.at(-1)?.id !== action.id) return { ...state, isExecuting: false };
      return { entries: state.entries.slice(0, -1), isExecuting: false };
    case "failed":
      return state.isExecuting ? { ...state, isExecuting: false } : state;
    case "clear":
      return initialKonquerorFileUndoState;
  }
}
