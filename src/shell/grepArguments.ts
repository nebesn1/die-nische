import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";

export interface ShellGrepArguments {
  readonly ignoreCase: boolean;
  readonly showLineNumbers: boolean;
  readonly pattern: string;
  readonly path: string;
}

export function parseShellGrepArguments(args: readonly string[]): ShellResult<ShellGrepArguments> {
  let ignoreCase = false;
  let showLineNumbers = false;
  let index = 0;

  while (index < args.length && args[index]?.startsWith("-")) {
    const option = args[index] ?? "";

    if (option !== "-i" && option !== "-n") {
      return shellFail(createShellError("UNSUPPORTED_OPTION", `grep: unsupported option: ${option}`));
    }

    if ((option === "-i" && ignoreCase) || (option === "-n" && showLineNumbers)) {
      return shellFail(createShellError("INVALID_ARGUMENT", `grep: duplicate option: ${option}`));
    }

    ignoreCase = ignoreCase || option === "-i";
    showLineNumbers = showLineNumbers || option === "-n";
    index += 1;
  }

  if (args.length - index !== 2) {
    return shellFail(
      createShellError("INVALID_ARGUMENT_COUNT", "grep usage: grep [-i] [-n] <pattern> <path>"),
    );
  }

  return shellOk({
    ignoreCase,
    showLineNumbers,
    pattern: args[index] ?? "",
    path: args[index + 1] ?? "",
  });
}
