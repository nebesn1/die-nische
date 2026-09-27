import { stdout } from "../formatting";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const echoCommand: ShellCommandDefinition = {
  name: "echo",
  usage: "echo [text...]",
  description: "print text without variable or escape expansion",
  execute({ cwdNodeId, invocation }): ShellCommandExecution {
    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(`${invocation.args.join(" ")}\n`),
      clearTranscript: false,
    };
  },
};
