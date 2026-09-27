import type { ShellOutputChunk } from "./types";
import type { VfsError } from "../vfs/errors";

export const stdout = (text: string): readonly ShellOutputChunk[] =>
  text.length === 0
    ? []
    : [
        {
          stream: "stdout",
          text,
        },
      ];

export const stderr = (text: string): readonly ShellOutputChunk[] =>
  text.length === 0
    ? []
    : [
        {
          stream: "stderr",
          text,
        },
      ];

export const system = (text: string): ShellOutputChunk => ({
  stream: "system",
  text,
});

export function formatCdVfsError(path: string, error: VfsError): string {
  if (error.code === "NOT_FOUND") {
    return `cd: no such file or directory: ${path}`;
  }

  if (error.code === "NOT_DIRECTORY" || error.code === "IS_DIRECTORY") {
    return `cd: not a directory: ${path}`;
  }

  if (error.code === "INVALID_PATH") {
    return `cd: invalid path: ${path}`;
  }

  return `cd: ${error.message}`;
}

export function formatLsVfsError(path: string, error: VfsError): string {
  if (error.code === "NOT_FOUND") {
    return `ls: cannot access ${path}: no such file or directory`;
  }

  if (error.code === "NOT_DIRECTORY") {
    return `ls: not a directory: ${path}`;
  }

  if (error.code === "INVALID_PATH") {
    return `ls: invalid path: ${path}`;
  }

  return `ls: ${error.message}`;
}

export function formatCatVfsError(path: string, error: VfsError): string {
  if (error.code === "IS_DIRECTORY") {
    return `cat: ${path}: is a directory`;
  }

  if (error.code === "NOT_FOUND") {
    return `cat: ${path}: no such file`;
  }

  if (error.code === "NOT_DIRECTORY") {
    return `cat: ${path}: a path component is not a directory`;
  }

  if (error.code === "INVALID_PATH") {
    return `cat: ${path}: invalid path`;
  }

  return `cat: ${path}: ${error.message}`;
}

export function formatShellMutationVfsError(commandName: string, operand: string, error: VfsError): string {
  if (error.code === "INVALID_PATH" || error.code === "INVALID_NAME") {
    return `${commandName}: invalid path: ${operand}`;
  }

  if (error.code === "NOT_FOUND") {
    return `${commandName}: no such file or directory: ${operand}`;
  }

  if (error.code === "NOT_DIRECTORY") {
    return `${commandName}: not a directory: ${operand}`;
  }

  if (error.code === "IS_DIRECTORY") {
    return `${commandName}: is a directory: ${operand}`;
  }

  if (error.code === "ALREADY_EXISTS") {
    return commandName === "mkdir"
      ? `${commandName}: already exists: ${operand}`
      : `${commandName}: destination already exists: ${operand}`;
  }

  if (error.code === "INVALID_DESTINATION") {
    return `${commandName}: invalid destination: ${operand}`;
  }

  if (error.code === "SPECIAL_LOCATION_OPERATION_FORBIDDEN" || error.code === "ROOT_OPERATION_FORBIDDEN") {
    return `${commandName}: operation not permitted: ${operand}`;
  }

  if (error.code === "ALREADY_IN_TRASH") {
    return `${commandName}: already in Trash: ${operand}`;
  }

  return `${commandName}: ${error.message}`;
}

export function formatShellTrashManagementVfsError(commandName: "restore" | "permanent-delete", operand: string, error: VfsError): string {
  if (error.code === "NOT_FOUND") {
    return `${commandName}: no such Trash item: ${operand}`;
  }

  if (error.code === "NOT_IN_TRASH") {
    return `${commandName}: not a top-level Trash item: ${operand}`;
  }

  if (commandName === "restore" && error.code === "ALREADY_EXISTS") {
    return "restore: an item with this name already exists in the original folder";
  }

  if (commandName === "restore" && error.code === "RESTORE_TARGET_UNAVAILABLE") {
    return "restore: the original folder is no longer available";
  }

  return `${commandName}: ${error.message}`;
}
