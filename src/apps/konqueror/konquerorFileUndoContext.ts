import { createContext, type Dispatch } from "react";
import type { VfsFileOperationUndoEntry } from "../../vfs/fileOperationUndo";
import type { VfsResult } from "../../vfs/result";
import type { KonquerorFileUndoAction, KonquerorFileUndoState } from "./fileUndoHistory";

export type KonquerorFileUndoContextValue = {
  readonly state: KonquerorFileUndoState;
  readonly dispatch: Dispatch<KonquerorFileUndoAction>;
  record(entry: VfsFileOperationUndoEntry): void;
  undo(now: string): VfsResult<void>;
};

export const KonquerorFileUndoContext = createContext<KonquerorFileUndoContextValue | null>(null);
