import type { VfsError } from "../../vfs/errors";

export function formatKonquerorMutationError(error: VfsError): string {
  switch (error.code) {
    case "INVALID_NAME":
      return "The name is not valid.";
    case "ALREADY_EXISTS":
      return "An item with this name already exists.";
    case "NOT_FOUND":
      return "The original item or folder no longer exists.";
    case "NOT_DIRECTORY":
      return "The target location is not a folder.";
    case "ROOT_OPERATION_FORBIDDEN":
      return "The root folder cannot be renamed.";
    case "INVALID_PATH":
      return "The target path is not valid.";
    case "IS_DIRECTORY":
      return "The target is a folder.";
    default:
      return error.message;
  }
}
