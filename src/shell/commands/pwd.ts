import { createShellError } from "../errors";
import { stderr, stdout } from "../formatting";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const pwdCommand: ShellCommandDefinition = {
  name: "pwd",
  usage: "pwd",
  description: "print the current directory",
  execute({ cwdNodeId, cwdPath, invocation }): ShellCommandExecution {
    if (invocation.args.length !== 0) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "pwd does not accept arguments.").message),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(cwdPath),
      clearTranscript: false,
    };
  },
};
