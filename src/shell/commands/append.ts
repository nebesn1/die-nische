import { createShellError } from "../errors";
import { formatShellMutationVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, requireShellMutationPort } from "../mutationEnvironment";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";
import { isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsError } from "../../vfs/errors";

const formatAppendVfsError = (path: string, error: VfsError): string => {
  if (error.code === "NOT_FOUND") {
    return `append: no such file: ${path}`;
  }

  if (error.code === "IS_DIRECTORY") {
    return `append: is a directory: ${path}`;
  }

  if (error.code === "NOT_DIRECTORY") {
    return `append: no such file: ${path}`;
  }

  if (error.code === "INVALID_PATH") {
    return `append: invalid path: ${path}`;
  }

  return formatShellMutationVfsError("append", path, error);
};

export const appendCommand: ShellCommandDefinition = {
  name: "append",
  usage: "append <path> <text...>",
  description: "append a line of UTF-8 text to an existing file",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, cwdPath, invocation, vfsState } = context;

    if (invocation.args.length < 2) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "append requires a path and text.").message),
        clearTranscript: false,
      };
    }

    const pathOperand = invocation.args[0] ?? "";

    if (pathOperand.startsWith("-")) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `append: unsupported option: ${pathOperand}`).message),
        clearTranscript: false,
      };
    }

    const mutations = requireShellMutationPort(context);

    if (!mutations.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(mutations.error.message),
        clearTranscript: false,
      };
    }

    const target = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, pathOperand), cwdPath);

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatAppendVfsError(pathOperand, target.error)),
        clearTranscript: false,
      };
    }

    if (target.value.kind === "directory") {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(`append: is a directory: ${pathOperand}`),
        clearTranscript: false,
      };
    }

    if (isVfsNodeInsideTrash(vfsState, target.value.id)) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(`append: files in the Trash are read-only: ${pathOperand}`),
        clearTranscript: false,
      };
    }

    const path = getVfsPathForNode(vfsState, target.value.id);

    if (!path.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatAppendVfsError(pathOperand, path.error)),
        clearTranscript: false,
      };
    }

    const appended = mutations.value.appendTextFile(path.value, `${invocation.args.slice(1).join(" ")}\n`, {
      now: getShellMutationTimestamp(context),
    });

    if (!appended.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatAppendVfsError(pathOperand, appended.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: [],
      clearTranscript: false,
    };
  },
};
