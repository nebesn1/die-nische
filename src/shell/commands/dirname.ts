import { stderr, stdout } from "../formatting";
import { getShellPosixDirname } from "../posixPath";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const dirnameCommand: ShellCommandDefinition = {
  name: "dirname",
  usage: "dirname <path>",
  description: "return a lexical POSIX dirname; the path does not need to exist",
  execute({ cwdNodeId, invocation }): ShellCommandExecution {
    if (invocation.args.length !== 1) {
      return { exitCode: 2, cwdNodeId, output: stderr("dirname usage: dirname <path>"), clearTranscript: false };
    }

    return { exitCode: 0, cwdNodeId, output: stdout(`${getShellPosixDirname(invocation.args[0] ?? "")}\n`), clearTranscript: false };
  },
};
