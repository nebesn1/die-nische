import { createShellError } from "../errors";
import { stderr } from "../formatting";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const clearCommand: ShellCommandDefinition = {
  name: "clear",
  usage: "clear",
  description: "clear the shell transcript",
  execute({ cwdNodeId, invocation }): ShellCommandExecution {
    if (invocation.args.length !== 0) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "clear does not accept arguments.").message),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: [],
      clearTranscript: true,
    };
  },
};
