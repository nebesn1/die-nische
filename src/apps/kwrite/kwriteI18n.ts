import type { TranslationKey } from "../../i18n/messages/en";
import type { KWritePendingAction } from "./documentLifecycle";
import type { KWriteDialogError } from "./dialogModel";

type Translator = (key: TranslationKey, params?: Readonly<Record<string, string | number>>) => string;

const messageKeys: Readonly<Record<string, TranslationKey>> = {
  "The text file is no longer available.": "kwrite.fileUnavailable",
  "Files cannot be saved in the Trash.": "kwrite.trashSaveError",
  "Files in the Trash are read-only.": "kwrite.trashReadOnly",
  "The selected replacement file is no longer available.": "kfind.replacementUnavailable",
  "The selected directory is no longer available.": "kfind.directoryUnavailable",
  "A folder with that name already exists.": "kfind.folderExists",
  "This document cannot be saved in its current state.": "kwrite.saveStateError",
  "This document cannot be saved as a text file.": "kwrite.textFileError",
  "The selected file is no longer available.": "kwrite.fileUnavailable",
  "Saving the document failed.": "kwrite.saveFailed",
  "Unsaved changes prevent opening another file.": "kwrite.unsavedOpen",
  "The requested text file is no longer available.": "kwrite.requestedUnavailable",
  Saved: "kwrite.saved",
  "File is no longer available": "kwrite.fileUnavailable",
  "External changes detected": "kwrite.externalChanges",
  "Read-only - file is in Trash": "kwrite.trashReadOnly",
  "Read-only - mixed line endings are not editable in this version": "kwrite.mixedReadOnly",
  "Untitled - no backing file": "kwrite.untitledNoFile",
  Modified: "kwrite.modified",
  "Node name cannot be empty.": "kwrite.invalidNameEmpty",
  "Node name cannot be a path segment.": "kwrite.invalidNameSegment",
  "Node name contains an invalid character.": "kwrite.invalidNameCharacter",
};

export function translateKWriteMessage(message: string, t: Translator): string {
  const key = messageKeys[message];
  return key === undefined ? message : t(key);
}

export function getKWriteDialogError(message: string): KWriteDialogError {
  const key = messageKeys[message];
  return key === undefined ? { type: "raw", message } : { type: "translation", key };
}

export function translateKWriteReplacementMessage(action: KWritePendingAction, t: Translator): string {
  return t(action.type === "new" ? "kwrite.saveBeforeNew" : "kwrite.saveBeforeOpen");
}
