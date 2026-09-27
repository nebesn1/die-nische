import { canSaveAsKWriteDocument, canSaveKWriteDocument, type KWriteDocumentState } from "./documentModel";

export type KWriteCloseSaveMode = "save" | "save-as" | "unavailable";

export function shouldConfirmKWriteClose(document: KWriteDocumentState): boolean {
  return document.dirty;
}

export function getKWriteCloseSaveMode(document: KWriteDocumentState): KWriteCloseSaveMode {
  if (canSaveKWriteDocument(document)) {
    return "save";
  }

  return canSaveAsKWriteDocument(document) ? "save-as" : "unavailable";
}
