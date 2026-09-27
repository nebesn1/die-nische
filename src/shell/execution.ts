import { getShellCommandDefinition } from "./commandRegistry";
import { createShellError } from "./errors";
import { parseShellInput } from "./parser";
import { validateShellCwd } from "./session";
import type {
  ShellCommandExecution,
  ShellExecutionEnvironment,
  ShellInputExecutionResult,
  ShellOutputChunk,
  ShellSessionState,
} from "./types";
import type { VfsState } from "../vfs/types";

const createExecution = (
  exitCode: number,
  cwdNodeId: string,
  output: readonly ShellOutputChunk[],
  clearTranscript = false,
): ShellCommandExecution => ({
  exitCode,
  cwdNodeId,
  output,
  clearTranscript,
});

const appendSessionResult = (
  session: ShellSessionState,
  input: string,
  cwdPath: string,
  execution: ShellCommandExecution,
): ShellSessionState => {
  const commandHistory = [...session.commandHistory, input];

  if (execution.clearTranscript && execution.exitCode === 0) {
    return {
      cwdNodeId: execution.cwdNodeId,
      transcript: [],
      commandHistory,
      nextTranscriptEntryId: session.nextTranscriptEntryId,
    };
  }

  return {
    cwdNodeId: execution.cwdNodeId,
    commandHistory,
    transcript: [
      ...session.transcript,
      {
        id: session.nextTranscriptEntryId,
        input,
        cwdPath,
        output: execution.output,
        exitCode: execution.exitCode,
      },
    ],
    nextTranscriptEntryId: session.nextTranscriptEntryId + 1,
  };
};

export function executeShellInput(
  session: ShellSessionState,
  vfsState: VfsState,
  input: string,
  environment: ShellExecutionEnvironment = {},
): ShellInputExecutionResult {
  if (input.trim().length === 0) {
    return {
      session,
      execution: null,
    };
  }

  const cwd = validateShellCwd(session, vfsState);
  const warningOutput = cwd.warning ? [cwd.warning] : [];
  const baseSession: ShellSessionState = {
    ...session,
    cwdNodeId: cwd.cwdNodeId,
  };
  const parsed = parseShellInput(input);

  if (!parsed.ok) {
    const execution = createExecution(2, cwd.cwdNodeId, [
      ...warningOutput,
      {
        stream: "stderr",
        text: parsed.error.message,
      },
    ]);

    return {
      execution,
      session: appendSessionResult(baseSession, input, cwd.cwdPath, execution),
    };
  }

  if (!parsed.value) {
    return {
      session,
      execution: null,
    };
  }

  const command = getShellCommandDefinition(parsed.value.commandName);

  if (!command) {
    const error = createShellError("UNKNOWN_COMMAND", `${parsed.value.commandName}: command not found`, {
      commandName: parsed.value.commandName,
      input,
    });
    const execution = createExecution(2, cwd.cwdNodeId, [
      ...warningOutput,
      {
        stream: "stderr",
        text: error.message,
      },
    ]);

    return {
      execution,
      session: appendSessionResult(baseSession, input, cwd.cwdPath, execution),
    };
  }

  const commandExecution = command.execute({
    vfsState,
    cwdNodeId: cwd.cwdNodeId,
    cwdPath: cwd.cwdPath,
    commandHistory: baseSession.commandHistory,
    invocation: parsed.value,
    environment,
  });
  const execution: ShellCommandExecution = {
    ...commandExecution,
    output: [...warningOutput, ...commandExecution.output],
  };

  return {
    execution,
    session: appendSessionResult(baseSession, input, cwd.cwdPath, execution),
  };
}
