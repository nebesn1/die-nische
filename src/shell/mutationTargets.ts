import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";
import { expandShellPathOperand } from "./path";
import { getVfsBasename, getVfsDirname, normalizeVfsPath, validateVfsNodeName } from "../vfs/path";
import { getVfsPathForNode, getVfsTrashEntry, resolveVfsPath } from "../vfs/queries";
import { isVfsNodeInsideTrash } from "../vfs/tree";
import type { VfsNode, VfsState, VfsTrashEntry } from "../vfs/types";

export interface ShellCreationTarget {
  readonly absolutePath: string;
  readonly parentPath: string;
  readonly name: string;
}

export interface ShellTransferTarget {
  readonly sourceNode: VfsNode;
  readonly sourcePath: string;
  readonly destinationDirectoryPath: string;
  readonly newName?: string;
}

export interface ShellTrashEntryTarget {
  readonly node: VfsNode;
  readonly nodeId: string;
  readonly path: string;
  readonly entry: VfsTrashEntry;
}

const asShellVfsError = (commandName: string, input: string, message: string, causeCode: Parameters<typeof createShellError>[0] = "VFS_ERROR") =>
  createShellError(causeCode, message, { commandName, input });

const resolveCwdPath = (vfsState: VfsState, cwdNodeId: string, commandName: string, input: string): ShellResult<string> => {
  const cwdPath = getVfsPathForNode(vfsState, cwdNodeId);

  if (!cwdPath.ok) {
    return shellFail(createShellError("CWD_UNAVAILABLE", "shell: current directory is no longer available", {
      commandName,
      input,
      cause: cwdPath.error,
    }));
  }

  return shellOk(cwdPath.value);
};

export function resolveShellCreationTarget(
  vfsState: VfsState,
  cwdNodeId: string,
  operand: string,
  commandName: string,
): ShellResult<ShellCreationTarget> {
  const cwdPath = resolveCwdPath(vfsState, cwdNodeId, commandName, operand);

  if (!cwdPath.ok) {
    return cwdPath;
  }

  const normalized = normalizeVfsPath(expandShellPathOperand(vfsState, operand), cwdPath.value);

  if (!normalized.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid path: ${operand}`, {
      commandName,
      input: operand,
      cause: normalized.error,
    }));
  }

  if (normalized.value === "/") {
    return shellFail(asShellVfsError(commandName, operand, `${commandName}: invalid path: ${operand}`));
  }

  const parentPath = getVfsDirname(normalized.value);
  const name = getVfsBasename(normalized.value);
  const validName = validateVfsNodeName(name);

  if (!validName.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid path: ${operand}`, {
      commandName,
      input: operand,
      cause: validName.error,
    }));
  }

  const parent = resolveVfsPath(vfsState, parentPath);

  if (!parent.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such file or directory: ${operand}`, {
      commandName,
      input: operand,
      cause: parent.error,
    }));
  }

  if (parent.value.kind !== "directory") {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: not a directory: ${operand}`, {
      commandName,
      input: operand,
      cause: {
        code: "NOT_DIRECTORY",
        message: "Target parent is not a directory.",
        path: parentPath,
        nodeId: parent.value.id,
      },
    }));
  }

  if (isVfsNodeInsideTrash(vfsState, parent.value.id)) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid destination: ${operand}`, {
      commandName,
      input: operand,
      cause: {
        code: "INVALID_DESTINATION",
        message: "Regular shell writes cannot target Trash.",
        path: parentPath,
        nodeId: parent.value.id,
      },
    }));
  }

  return shellOk({
    absolutePath: normalized.value,
    parentPath,
    name: validName.value,
  });
}

export function resolveShellTransferTarget(
  vfsState: VfsState,
  cwdNodeId: string,
  sourceOperand: string,
  destinationOperand: string,
  commandName: "cp" | "mv",
): ShellResult<ShellTransferTarget> {
  const cwdPath = resolveCwdPath(vfsState, cwdNodeId, commandName, sourceOperand);

  if (!cwdPath.ok) {
    return cwdPath;
  }

  const expandedSourceOperand = expandShellPathOperand(vfsState, sourceOperand);
  const expandedDestinationOperand = expandShellPathOperand(vfsState, destinationOperand);
  const source = resolveVfsPath(vfsState, expandedSourceOperand, cwdPath.value);

  if (!source.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such file or directory: ${sourceOperand}`, {
      commandName,
      input: sourceOperand,
      cause: source.error,
    }));
  }

  if (isVfsNodeInsideTrash(vfsState, source.value.id)) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid destination: ${sourceOperand}`, {
      commandName,
      input: sourceOperand,
      cause: {
        code: "INVALID_DESTINATION",
        message: "Regular copy and move cannot operate on Trash contents.",
        nodeId: source.value.id,
      },
    }));
  }

  const sourcePath = getVfsPathForNode(vfsState, source.value.id);

  if (!sourcePath.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such file or directory: ${sourceOperand}`, {
      commandName,
      input: sourceOperand,
      cause: sourcePath.error,
    }));
  }

  const destinationNormalized = normalizeVfsPath(expandedDestinationOperand, cwdPath.value);

  if (!destinationNormalized.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid path: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: destinationNormalized.error,
    }));
  }

  const destination = resolveVfsPath(vfsState, expandedDestinationOperand, cwdPath.value);

  if (destination.ok) {
    if (destination.value.id === source.value.id) {
      if (commandName === "mv") {
        return shellOk({
          sourceNode: source.value,
          sourcePath: sourcePath.value,
          destinationDirectoryPath: getVfsDirname(sourcePath.value),
          newName: source.value.name,
        });
      }

      return shellFail(createShellError("VFS_ERROR", `${commandName}: destination already exists: ${destinationOperand}`, {
        commandName,
        input: destinationOperand,
        cause: {
          code: "ALREADY_EXISTS",
          message: "Destination already exists.",
          path: destinationNormalized.value,
          nodeId: destination.value.id,
        },
      }));
    }

    if (destination.value.kind === "directory") {
      if (isVfsNodeInsideTrash(vfsState, destination.value.id)) {
        return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid destination: ${destinationOperand}`, {
          commandName,
          input: destinationOperand,
          cause: {
            code: "INVALID_DESTINATION",
            message: "Regular copy and move cannot target Trash.",
            path: destinationNormalized.value,
            nodeId: destination.value.id,
          },
        }));
      }

      return shellOk({
        sourceNode: source.value,
        sourcePath: sourcePath.value,
        destinationDirectoryPath: destinationNormalized.value,
      });
    }

    return shellFail(createShellError("VFS_ERROR", `${commandName}: destination already exists: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: {
        code: "ALREADY_EXISTS",
        message: "Destination already exists.",
        path: destinationNormalized.value,
        nodeId: destination.value.id,
      },
    }));
  }

  if (destinationOperand.endsWith("/")) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such file or directory: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: destination.error,
    }));
  }

  const parentPath = getVfsDirname(destinationNormalized.value);
  const newName = getVfsBasename(destinationNormalized.value);
  const validName = validateVfsNodeName(newName);

  if (!validName.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid path: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: validName.error,
    }));
  }

  const parent = resolveVfsPath(vfsState, parentPath);

  if (!parent.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such file or directory: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: parent.error,
    }));
  }

  if (parent.value.kind !== "directory") {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: not a directory: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: {
        code: "NOT_DIRECTORY",
        message: "Destination parent is not a directory.",
        path: parentPath,
        nodeId: parent.value.id,
      },
    }));
  }

  if (isVfsNodeInsideTrash(vfsState, parent.value.id)) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: invalid destination: ${destinationOperand}`, {
      commandName,
      input: destinationOperand,
      cause: {
        code: "INVALID_DESTINATION",
        message: "Regular copy and move cannot target Trash.",
        path: parentPath,
        nodeId: parent.value.id,
      },
    }));
  }

  return shellOk({
    sourceNode: source.value,
    sourcePath: sourcePath.value,
    destinationDirectoryPath: parentPath,
    newName: validName.value,
  });
}

export function resolveShellTrashEntryOperand(
  vfsState: VfsState,
  cwdNodeId: string,
  operand: string,
  commandName: "restore" | "permanent-delete",
): ShellResult<ShellTrashEntryTarget> {
  const cwdPath = resolveCwdPath(vfsState, cwdNodeId, commandName, operand);

  if (!cwdPath.ok) {
    return cwdPath;
  }

  const node = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, operand), cwdPath.value);

  if (!node.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such Trash item: ${operand}`, {
      commandName,
      input: operand,
      cause: node.error,
    }));
  }

  if (node.value.id === vfsState.specialLocations.trash || node.value.parentId !== vfsState.specialLocations.trash) {
    const message = isVfsNodeInsideTrash(vfsState, node.value.id)
      ? `${commandName}: only top-level Trash items can be managed: ${operand}`
      : `${commandName}: not a top-level Trash item: ${operand}`;

    return shellFail(createShellError("VFS_ERROR", message, {
      commandName,
      input: operand,
      cause: {
        code: "NOT_IN_TRASH",
        message: "Only top-level Trash entries can be managed.",
        nodeId: node.value.id,
      },
    }));
  }

  const entry = getVfsTrashEntry(vfsState, node.value.id);

  if (!entry.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: not a top-level Trash item: ${operand}`, {
      commandName,
      input: operand,
      cause: entry.error,
    }));
  }

  const path = getVfsPathForNode(vfsState, node.value.id);

  if (!path.ok) {
    return shellFail(createShellError("VFS_ERROR", `${commandName}: no such Trash item: ${operand}`, {
      commandName,
      input: operand,
      cause: path.error,
    }));
  }

  return shellOk({
    node: node.value,
    nodeId: node.value.id,
    path: path.value,
    entry: entry.value,
  });
}
