import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";

export type ShellWcMode = "all" | "lines" | "words" | "bytes";

export interface ShellWcArguments {
  readonly mode: ShellWcMode;
  readonly path: string;
}

const optionModes: Readonly<Record<string, ShellWcMode>> = {
  "-l": "lines",
  "-w": "words",
  "-c": "bytes",
};

export function parseShellWcArguments(args: readonly string[]): ShellResult<ShellWcArguments> {
  if (args.length === 1 && !args[0]?.startsWith("-")) {
    return shellOk({ mode: "all", path: args[0] ?? "" });
  }

  if (args[0]?.startsWith("-")) {
    const mode = optionModes[args[0]];

    if (!mode) {
      return shellFail(createShellError("UNSUPPORTED_OPTION", `wc: unsupported option: ${args[0]}`));
    }

    if (args.length === 2) {
      return shellOk({ mode, path: args[1] ?? "" });
    }
  }

  return shellFail(createShellError("INVALID_ARGUMENT_COUNT", "wc usage: wc [-l|-w|-c] <path>"));
}
