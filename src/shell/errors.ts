import type { VfsError } from "../vfs/errors";

export type ShellErrorCode =
  | "PARSE_ERROR"
  | "UNSUPPORTED_SYNTAX"
  | "UNKNOWN_COMMAND"
  | "INVALID_ARGUMENT"
  | "INVALID_ARGUMENT_COUNT"
  | "UNSUPPORTED_OPTION"
  | "CONFIRMATION_REQUIRED"
  | "MUTATION_UNAVAILABLE"
  | "CWD_UNAVAILABLE"
  | "VFS_ERROR";

export interface ShellError {
  readonly code: ShellErrorCode;
  readonly message: string;
  readonly commandName?: string;
  readonly input?: string;
  readonly cause?: VfsError;
}

export type ShellResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: ShellError;
    };

export function createShellError(
  code: ShellErrorCode,
  message: string,
  details: Pick<ShellError, "commandName" | "input" | "cause"> = {},
): ShellError {
  return {
    code,
    message,
    ...details,
  };
}

export function shellOk<T>(value: T): ShellResult<T> {
  return { ok: true, value };
}

export function shellFail<T = never>(error: ShellError): ShellResult<T> {
  return { ok: false, error };
}
