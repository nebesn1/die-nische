import type { VfsNodeId } from "../../vfs/types";
import {
  canSaveAsKWriteDocument,
  canSaveKWriteDocument,
  createInitialKWriteDocumentState,
  type KWriteDocumentState,
} from "./documentModel";

export type KWritePendingAction =
  | { readonly type: "new" }
  | { readonly type: "open-dialog" }
  | { readonly type: "open-node"; readonly nodeId: VfsNodeId };

export interface KWritePendingReplacement {
  readonly id: number;
  readonly action: KWritePendingAction;
}

export type KWriteReplacementDecision = "save" | "discard" | "cancel";

export function isKWriteSameDocumentAction(
  document: KWriteDocumentState,
  action: KWritePendingAction,
): boolean {
  return action.type === "open-node" && document.nodeId === action.nodeId;
}

export function shouldConfirmKWriteReplacement(
  document: KWriteDocumentState,
  action: KWritePendingAction,
): boolean {
  return document.dirty && !isKWriteSameDocumentAction(document, action);
}

export function getKWriteReplacementSaveMode(
  document: KWriteDocumentState,
): "save" | "save-as" | "unavailable" {
  if (canSaveKWriteDocument(document)) {
    return "save";
  }

  return canSaveAsKWriteDocument(document) ? "save-as" : "unavailable";
}

export function discardKWriteDocumentForReplacement(
  document: KWriteDocumentState,
  action: KWritePendingAction,
): KWriteDocumentState {
  return action.type === "new" ? createInitialKWriteDocumentState() : document;
}

export function getKWriteReplacementMessage(action: KWritePendingAction): string {
  return action.type === "new"
    ? "Save changes before creating a new document?"
    : "Save changes before opening another document?";
}
