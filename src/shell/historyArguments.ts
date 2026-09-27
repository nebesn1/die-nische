import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";

export interface ShellHistoryArguments {
  readonly count: number | null;
}

const historyUsage = "history usage: history [count]";

export function parseHistoryArguments(args: readonly string[]): ShellResult<ShellHistoryArguments> {
  if (args.length === 0) {
    return shellOk({ count: null });
  }

  if (args.length !== 1) {
    if (args[0]?.startsWith("-") && !/^-[0-9]+$/.test(args[0])) {
      return shellFail(createShellError("UNSUPPORTED_OPTION", `history: unsupported option: ${args[0]}`));
    }

    return shellFail(createShellError("INVALID_ARGUMENT_COUNT", historyUsage));
  }

  const value = args[0] ?? "";

  if (!/^[0-9]+$/.test(value)) {
    if (value.startsWith("-") && !/^-[0-9]+$/.test(value)) {
      return shellFail(createShellError("UNSUPPORTED_OPTION", `history: unsupported option: ${value}`));
    }

    return shellFail(createShellError("INVALID_ARGUMENT", `history: invalid count: ${value}`));
  }

  const count = Number(value);

  if (!Number.isSafeInteger(count)) {
    return shellFail(createShellError("INVALID_ARGUMENT", `history: invalid count: ${value}`));
  }

  return shellOk({ count });
}
