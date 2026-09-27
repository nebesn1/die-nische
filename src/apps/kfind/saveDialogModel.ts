import type { VfsNodeId } from "../../vfs/types";

export type KFindSaveDialogState =
  | { readonly type: "none" }
  | {
      readonly type: "save";
      readonly directoryNodeId: VfsNodeId;
      readonly selectedDirectoryNodeId: VfsNodeId | null;
      readonly filename: string;
      readonly autoExtension: boolean;
      readonly error: string | null;
    }
  | { readonly type: "overwrite"; readonly directoryNodeId: VfsNodeId; readonly filename: string; readonly targetNodeId: VfsNodeId; readonly autoExtension: boolean; readonly error: string | null };

export const initialKFindSaveDialogState: KFindSaveDialogState = { type: "none" };
