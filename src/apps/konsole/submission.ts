import {
  appendShellPromptOnlyTranscript,
  executeShellInput,
  type ShellExecutionEnvironment,
  type ShellInputExecutionResult,
  type ShellSessionState,
} from "../../shell";
import type { VfsState } from "../../vfs/types";
import { getKonsolePromptPath } from "./promptFormatting";

export function submitKonsoleShellInput(
  session: ShellSessionState,
  vfsState: VfsState,
  input: string,
  environment: ShellExecutionEnvironment,
): ShellInputExecutionResult {
  if (input.trim().length === 0) {
    return {
      session: appendShellPromptOnlyTranscript(session, getKonsolePromptPath(vfsState, session.cwdNodeId)),
      execution: null,
    };
  }

  return executeShellInput(session, vfsState, input, environment);
}
