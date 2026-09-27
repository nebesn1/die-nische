import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";

export type ShellLineSelectionCommandName = "head" | "tail";

export interface ShellLineSelectionArguments {
  readonly count: number;
  readonly path: string;
}

const defaultLineCount = 10;

const parseLineCount = (
  commandName: ShellLineSelectionCommandName,
  value: string,
): ShellResult<number> => {
  if (!/^[0-9]+$/.test(value)) {
    return shellFail(createShellError("INVALID_ARGUMENT", `${commandName}: invalid line count: ${value}`));
  }

  const count = Number(value);

  if (!Number.isSafeInteger(count)) {
    return shellFail(createShellError("INVALID_ARGUMENT", `${commandName}: invalid line count: ${value}`));
  }

  return shellOk(count);
};

export function parseShellLineSelectionArguments(
  commandName: ShellLineSelectionCommandName,
  args: readonly string[],
): ShellResult<ShellLineSelectionArguments> {
  if (args[0] === "-n") {
    if (args.length !== 3) {
      return shellFail(
        createShellError("INVALID_ARGUMENT_COUNT", `${commandName} usage: ${commandName} [-n <count>] <path>`),
      );
    }

    const count = parseLineCount(commandName, args[1] ?? "");

    if (!count.ok) {
      return count;
    }

    return shellOk({
      count: count.value,
      path: args[2] ?? "",
    });
  }

  if (args.length === 1) {
    const path = args[0] ?? "";

    if (path.startsWith("-")) {
      return shellFail(createShellError("UNSUPPORTED_OPTION", `${commandName}: unsupported option: ${path}`));
    }

    return shellOk({
      count: defaultLineCount,
      path,
    });
  }

  if (args[0]?.startsWith("-")) {
    return shellFail(createShellError("UNSUPPORTED_OPTION", `${commandName}: unsupported option: ${args[0]}`));
  }

  return shellFail(createShellError("INVALID_ARGUMENT_COUNT", `${commandName} usage: ${commandName} [-n <count>] <path>`));
}
