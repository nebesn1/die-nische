import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";

export interface ShellFindArguments {
  readonly startPath: string;
  readonly name: string | null;
}

const usageError = (): ShellResult<ShellFindArguments> =>
  shellFail(createShellError("INVALID_ARGUMENT_COUNT", "find usage: find [path] [-name <literal-name>]"));

export function parseShellFindArguments(args: readonly string[]): ShellResult<ShellFindArguments> {
  if (args.length === 0) {
    return shellOk({ startPath: ".", name: null });
  }

  if (args[0] === "-name") {
    return args.length === 2 ? shellOk({ startPath: ".", name: args[1] ?? "" }) : usageError();
  }

  if (args[0]?.startsWith("-")) {
    return shellFail(createShellError("UNSUPPORTED_OPTION", `find: unsupported option: ${args[0]}`));
  }

  if (args.length === 1) {
    return shellOk({ startPath: args[0] ?? ".", name: null });
  }

  if (args.length === 3 && args[1] === "-name") {
    return shellOk({ startPath: args[0] ?? ".", name: args[2] ?? "" });
  }

  if (args[1]?.startsWith("-") && args[1] !== "-name") {
    return shellFail(createShellError("UNSUPPORTED_OPTION", `find: unsupported option: ${args[1]}`));
  }

  return usageError();
}
