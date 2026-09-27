import { createShellError } from "../errors";
import { formatCatVfsError, stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { readVfsTextFile } from "../../vfs/queries";

export const catCommand: ShellCommandDefinition = {
  name: "cat",
  usage: "cat <path>",
  description: "print a UTF-8 text file",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    if (invocation.args.length !== 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "cat requires exactly one path.").message),
        clearTranscript: false,
      };
    }

    const requestedPath = invocation.args[0];
    const file = readVfsTextFile(vfsState, expandShellPathOperand(vfsState, requestedPath), cwdPath);

    if (!file.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatCatVfsError(requestedPath, file.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(file.value.content.text),
      clearTranscript: false,
    };
  },
};
