import type { VfsNode, VfsNodeId } from "../../vfs/types";
import { enterVfsDialogDirectory, selectVfsDialogDirectory } from "../../vfs/vfsDialogController";
import type { KWritePendingReplacement } from "./documentLifecycle";
import type { TranslationKey } from "../../i18n/messages/en";

export type KWriteDialogError =
  | { readonly type: "translation"; readonly key: TranslationKey }
  | { readonly type: "raw"; readonly message: string };

export type KWriteCloseTarget =
  | { readonly type: "document" }
  | { readonly type: "window"; readonly requestId: number };

export type KWriteDialogState =
  | { readonly type: "none" }
  | { readonly type: "confirm-replacement"; readonly pending: KWritePendingReplacement; readonly error: KWriteDialogError | null }
  | { readonly type: "confirm-close"; readonly closeTarget: KWriteCloseTarget; readonly error: KWriteDialogError | null }
  | { readonly type: "open"; readonly directoryNodeId: VfsNodeId; readonly selectedNodeId: VfsNodeId | null; readonly error: KWriteDialogError | null }
  | {
      readonly type: "save-as";
      readonly directoryNodeId: VfsNodeId;
      readonly selectedNodeId: VfsNodeId | null;
      readonly selectedDirectoryNodeId: VfsNodeId | null;
      readonly filename: string;
      readonly pending: KWritePendingReplacement | null;
      readonly closeTarget: KWriteCloseTarget | null;
      readonly error: KWriteDialogError | null;
    }
  | {
      readonly type: "confirm-overwrite";
      readonly directoryNodeId: VfsNodeId;
      readonly filename: string;
      readonly targetNodeId: VfsNodeId;
      readonly pending: KWritePendingReplacement | null;
      readonly closeTarget: KWriteCloseTarget | null;
      readonly error: KWriteDialogError | null;
    };

export const initialKWriteDialogState: KWriteDialogState = { type: "none" };

export function createKWriteOpenDialog(directoryNodeId: VfsNodeId): KWriteDialogState {
  return { type: "open", directoryNodeId, selectedNodeId: null, error: null };
}

export function createKWriteSaveAsDialog(
  directoryNodeId: VfsNodeId,
  filename: string,
  pending: KWritePendingReplacement | null = null,
  closeTarget: KWriteCloseTarget | null = null,
): KWriteDialogState {
  return { type: "save-as", directoryNodeId, selectedNodeId: null, selectedDirectoryNodeId: null, filename, pending, closeTarget, error: null };
}

export function setKWriteDialogError(dialog: KWriteDialogState, error: KWriteDialogError): KWriteDialogState {
  return dialog.type === "none" ? dialog : { ...dialog, error };
}

export function selectKWriteDialogNode(
  dialog: KWriteDialogState,
  nodeId: VfsNodeId | null,
  nodeKind: VfsNode["kind"] | null = null,
): KWriteDialogState {
  if (dialog.type !== "open" && dialog.type !== "save-as") {
    return dialog;
  }

  return dialog.selectedNodeId === nodeId
    && (dialog.type !== "save-as" || dialog.selectedDirectoryNodeId === (nodeKind === "directory" ? nodeId : null))
    && dialog.error === null
    ? dialog
    : {
        ...dialog,
        selectedNodeId: nodeId,
        ...(dialog.type === "save-as" && nodeKind === "directory" && nodeId !== null
          ? { selectedDirectoryNodeId: selectVfsDialogDirectory(dialog.directoryNodeId, nodeId).selectedDirectoryNodeId }
          : dialog.type === "save-as" ? { selectedDirectoryNodeId: null } : {}),
        error: null,
      };
}

export function navigateKWriteDialogDirectory(dialog: KWriteDialogState, directoryNodeId: VfsNodeId): KWriteDialogState {
  if (dialog.type !== "open" && dialog.type !== "save-as") {
    return dialog;
  }

  const next = enterVfsDialogDirectory(directoryNodeId);
  return {
    ...dialog,
    directoryNodeId: next.currentDirectoryNodeId,
    selectedNodeId: null,
    ...(dialog.type === "save-as" ? { selectedDirectoryNodeId: next.selectedDirectoryNodeId } : {}),
    error: null,
  };
}
