import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";
import type { ShellCommandContext, ShellMutationPort } from "./types";

export const defaultShellNow = (): string => new Date().toISOString();

export function requireShellMutationPort(context: ShellCommandContext): ShellResult<ShellMutationPort> {
  if (!context.environment.mutations) {
    return shellFail(
      createShellError("MUTATION_UNAVAILABLE", "shell: write operations are not available in this session", {
        commandName: context.invocation.commandName,
        input: context.invocation.rawInput,
      }),
    );
  }

  return shellOk(context.environment.mutations);
}

export function getShellMutationTimestamp(context: ShellCommandContext): string {
  return (context.environment.now ?? defaultShellNow)();
}

export function hasUnsupportedShellOption(args: readonly string[]): string | null {
  return args.find((arg) => arg.startsWith("-")) ?? null;
}
