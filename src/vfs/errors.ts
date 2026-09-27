import type { VfsNodeId } from "./types";

export type VfsErrorCode =
  | "INVALID_PATH"
  | "INVALID_NAME"
  | "NOT_FOUND"
  | "NOT_DIRECTORY"
  | "IS_DIRECTORY"
  | "UNSUPPORTED_FILE_CONTENT"
  | "ALREADY_EXISTS"
  | "ROOT_OPERATION_FORBIDDEN"
  | "INVALID_DESTINATION"
  | "SPECIAL_LOCATION_OPERATION_FORBIDDEN"
  | "ALREADY_IN_TRASH"
  | "NOT_IN_TRASH"
  | "RESTORE_TARGET_UNAVAILABLE";

export interface VfsError {
  readonly code: VfsErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly nodeId?: VfsNodeId;
}

export function createVfsError(
  code: VfsErrorCode,
  message: string,
  details: Pick<VfsError, "path" | "nodeId"> = {},
): VfsError {
  return {
    code,
    message,
    ...details,
  };
}
