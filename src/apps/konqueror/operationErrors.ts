import type { VfsError } from "../../vfs/errors";
import type { Translator } from "../../i18n/I18nContext";

export type KonquerorFileOperationErrorContext = "clipboard" | "move-to-trash" | "trash" | "drag-drop";

export function formatKonquerorFileOperationError(
  error: VfsError,
  context: KonquerorFileOperationErrorContext = "clipboard",
  t?: Translator,
): string {
  const localized = (key: Parameters<Translator>[0], fallback: string): string => t ? t(key) : fallback;

  switch (error.code) {
    case "ALREADY_EXISTS":
      return error.message.includes("original")
        ? localized("konqueror.error.itemExistsOriginal", "An item with this name already exists in the original folder.")
        : localized("konqueror.error.itemExists", "An item with this name already exists in this folder.");
    case "RESTORE_TARGET_UNAVAILABLE":
      return localized("konqueror.error.originalUnavailable", "The original folder is no longer available.");
    case "NOT_IN_TRASH":
      return localized("konqueror.error.notInTrash", "The selected item is no longer in the Trash.");
    case "INVALID_DESTINATION":
      return localized("konqueror.error.invalidDestination", "The selected destination is not valid.");
    case "NOT_FOUND":
      return context === "move-to-trash"
        ? localized("konqueror.error.notFoundMove", "One or more selected items no longer exist.")
        : context === "trash"
        ? localized("konqueror.error.notFoundTrash", "One or more selected Trash items no longer exist.")
        : context === "drag-drop"
        ? localized("konqueror.error.notFoundDrag", "One or more dragged items no longer exist.")
        : localized("konqueror.error.notFoundClipboard", "The clipboard item no longer exists.");
    case "NOT_DIRECTORY":
      return context === "drag-drop"
        ? localized("konqueror.error.onlyDropFolder", "Items can only be dropped into a folder.")
        : localized("konqueror.error.onlyPasteFolder", "Items can only be pasted into a folder.");
    case "SPECIAL_LOCATION_OPERATION_FORBIDDEN":
      return localized("konqueror.error.specialFolder", "This system folder cannot be moved to the Trash.");
    case "ALREADY_IN_TRASH":
      return localized("konqueror.error.alreadyInTrash", "Items already in the Trash cannot be changed here.");
    case "ROOT_OPERATION_FORBIDDEN":
      return localized("konqueror.error.rootUnchangeable", "The root folder cannot be changed.");
    case "INVALID_PATH":
      return localized("konqueror.error.invalidPath", "The selected path is not valid.");
    default:
      return error.message;
  }
}
