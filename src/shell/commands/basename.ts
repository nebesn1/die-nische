import { stderr, stdout } from "../formatting";
import { getShellPosixBasename } from "../posixPath";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const basenameCommand: ShellCommandDefinition = {
  name: "basename",
  usage: "basename <path>",
  description: "return a lexical POSIX basename; the path does not need to exist",
  execute({ cwdNodeId, invocation }): ShellCommandExecution {
    if (invocation.args.length !== 1) {
      return { exitCode: 2, cwdNodeId, output: stderr("basename usage: basename <path>"), clearTranscript: false };
    }

    return { exitCode: 0, cwdNodeId, output: stdout(`${getShellPosixBasename(invocation.args[0] ?? "")}\n`), clearTranscript: false };
  },
};
