import { parseShellLineSelectionArguments } from "../lineSelectionArguments";
import { stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import { takeFirstTextLines } from "../textLines";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { readVfsTextFile } from "../../vfs/queries";
import type { VfsError } from "../../vfs/errors";

const formatHeadError = (path: string, error: VfsError): string => {
  if (error.code === "IS_DIRECTORY") {
    return `head: is a directory: ${path}`;
  }

  if (error.code === "NOT_FOUND") {
    return `head: no such file: ${path}`;
  }

  if (error.code === "NOT_DIRECTORY") {
    return `head: no such file: ${path}`;
  }

  if (error.code === "INVALID_PATH") {
    return `head: invalid path: ${path}`;
  }

  return `head: ${error.message}`;
};

export const headCommand: ShellCommandDefinition = {
  name: "head",
  usage: "head [-n <count>] <path>",
  description: "print the first lines of a UTF-8 text file",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    const parsed = parseShellLineSelectionArguments("head", invocation.args);

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
        output: stderr(formatHeadError(parsed.value.path, file.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(takeFirstTextLines(file.value.content.text, parsed.value.count)),
      clearTranscript: false,
    };
  },
};
