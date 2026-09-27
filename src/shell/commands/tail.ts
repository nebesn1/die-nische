import { parseShellLineSelectionArguments } from "../lineSelectionArguments";
import { stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import { takeLastTextLines } from "../textLines";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { readVfsTextFile } from "../../vfs/queries";
import type { VfsError } from "../../vfs/errors";

const formatTailError = (path: string, error: VfsError): string => {
  if (error.code === "IS_DIRECTORY") {
    return `tail: is a directory: ${path}`;
  }

  if (error.code === "NOT_FOUND") {
    return `tail: no such file: ${path}`;
  }

  if (error.code === "NOT_DIRECTORY") {
    return `tail: no such file: ${path}`;
  }

  if (error.code === "INVALID_PATH") {
    return `tail: invalid path: ${path}`;
  }

  return `tail: ${error.message}`;
};

export const tailCommand: ShellCommandDefinition = {
  name: "tail",
  usage: "tail [-n <count>] <path>",
  description: "print the last lines of a UTF-8 text file",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    const parsed = parseShellLineSelectionArguments("tail", invocation.args);

    if (!parsed.ok) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(parsed.error.message),
        clearTranscript: false,
      };
    }

    const file = readVfsTextFile(vfsState, expandShellPathOperand(vfsState, parsed.value.path), cwdPath);

    if (!file.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatTailError(parsed.value.path, file.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(takeLastTextLines(file.value.content.text, parsed.value.count)),
      clearTranscript: false,
    };
  },
};
