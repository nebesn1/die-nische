import { shellOk, type ShellResult } from "./errors";
import { tokenizeShellInput } from "./tokenizer";
import type { ShellCommandInvocation } from "./types";

export function parseShellInput(input: string): ShellResult<ShellCommandInvocation | null> {
  const tokens = tokenizeShellInput(input);

  if (!tokens.ok) {
    return tokens;
  }

  if (tokens.value.length === 0) {
    return shellOk(null);
  }

  const [commandName, ...args] = tokens.value.map((token) => token.value);

  return shellOk({
    commandName,
    args,
    rawInput: input,
  });
}
