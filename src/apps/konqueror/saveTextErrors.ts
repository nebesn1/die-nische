import type { VfsError } from "../../vfs/errors";
import { formatKonquerorNavigationError } from "./navigationController";

export function formatKonquerorSaveError(error: VfsError): string {
  switch (error.code) {
    case "NOT_FOUND":
      return "The file no longer exists.";
    case "IS_DIRECTORY":
      return "The selected item is not a text file.";
    default:
      return formatKonquerorNavigationError(error);
  }
}
