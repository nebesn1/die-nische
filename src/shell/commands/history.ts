import { stdout, stderr } from "../formatting";
import { parseHistoryArguments } from "../historyArguments";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

const formatHistory = (commandHistory: readonly string[], count: number | null): string => {
  const firstIndex = count === null ? 0 : Math.max(0, commandHistory.length - count);
  const entries = commandHistory.slice(firstIndex);

  return entries.length === 0
    ? ""
    : `${entries.map((entry, index) => `${firstIndex + index + 1}  ${entry}`).join("\n")}\n`;
};

export const historyCommand: ShellCommandDefinition = {
  name: "history",
  usage: "history [count]",
  description: "display current-session commands from oldest to newest",
  execute({ commandHistory, cwdNodeId, invocation }): ShellCommandExecution {
    const parsed = parseHistoryArguments(invocation.args);

    if (!parsed.ok) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(parsed.error.message),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(formatHistory(commandHistory, parsed.value.count)),
      clearTranscript: false,
    };
  },
};
