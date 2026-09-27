import type { ShellCompletionToken } from "./types";

export type ShellPathCompletionFilter = "directories" | "files" | "writable-files" | "all";

export type ShellCompletionContext =
  | {
      readonly kind: "command";
    }
  | {
      readonly kind: "help-topic";
    }
  | {
      readonly kind: "path";
      readonly filter: ShellPathCompletionFilter;
    }
  | {
      readonly kind: "trash-entry";
    }
  | {
      readonly kind: "none";
    };

export function getShellCompletionContext(
  commandName: string | null,
  activeTokenIndex: number,
  tokens: readonly ShellCompletionToken[] = [],
): ShellCompletionContext {
  if (activeTokenIndex === 0) {
    return { kind: "command" };
  }

  if (!commandName) {
    return { kind: "none" };
  }

  const argumentIndex = activeTokenIndex - 1;

  if (commandName === "help") {
    return argumentIndex === 0 ? { kind: "help-topic" } : { kind: "none" };
  }

  if (commandName === "cd") {
    return argumentIndex === 0 ? { kind: "path", filter: "directories" } : { kind: "none" };
  }

  if (commandName === "cat") {
    return argumentIndex === 0 ? { kind: "path", filter: "files" } : { kind: "none" };
  }

  if (commandName === "echo") {
    return { kind: "none" };
  }

  if (commandName === "history") {
    return { kind: "none" };
  }

  if (commandName === "append") {
    return argumentIndex === 0 ? { kind: "path", filter: "writable-files" } : { kind: "none" };
  }

  if (commandName === "head" || commandName === "tail") {
    if (argumentIndex === 0) {
      return tokens[activeTokenIndex]?.value.startsWith("-") ? { kind: "none" } : { kind: "path", filter: "files" };
    }

    return argumentIndex === 2 && tokens[1]?.value === "-n" ? { kind: "path", filter: "files" } : { kind: "none" };
  }

  if (commandName === "wc") {
    if (argumentIndex === 0) {
      return tokens[activeTokenIndex]?.value.startsWith("-") ? { kind: "none" } : { kind: "path", filter: "files" };
    }

    return argumentIndex === 1 && ["-l", "-w", "-c"].includes(tokens[1]?.value ?? "")
      ? { kind: "path", filter: "files" }
      : { kind: "none" };
  }

  if (commandName === "grep") {
    const completedArgs = tokens.slice(1, activeTokenIndex).map((token) => token.value);
    let index = 0;

    while (index < completedArgs.length && (completedArgs[index] === "-i" || completedArgs[index] === "-n")) {
      index += 1;
    }

    const operandIndex = argumentIndex - index;
    return operandIndex === 1 ? { kind: "path", filter: "files" } : { kind: "none" };
  }

  if (commandName === "find") {
    return argumentIndex === 0 && tokens[activeTokenIndex]?.value !== "-name"
      ? { kind: "path", filter: "all" }
      : { kind: "none" };
  }

  if (commandName === "stat" || commandName === "basename" || commandName === "dirname" || commandName === "tree") {
    return argumentIndex === 0 ? { kind: "path", filter: "all" } : { kind: "none" };
  }

  if (commandName === "ls" || commandName === "mkdir" || commandName === "touch" || commandName === "trash") {
    return argumentIndex === 0 ? { kind: "path", filter: "all" } : { kind: "none" };
  }

  if (commandName === "restore") {
    return argumentIndex === 0 ? { kind: "trash-entry" } : { kind: "none" };
  }

  if (commandName === "permanent-delete") {
    if (argumentIndex === 0) {
      return tokens[activeTokenIndex]?.value.startsWith("-") ? { kind: "none" } : { kind: "trash-entry" };
    }

    return argumentIndex === 1 && tokens[1]?.value === "--confirm" ? { kind: "trash-entry" } : { kind: "none" };
  }

  if (commandName === "empty-trash") {
    return { kind: "none" };
  }

  if (commandName === "cp" || commandName === "mv") {
    return argumentIndex === 0 || argumentIndex === 1 ? { kind: "path", filter: "all" } : { kind: "none" };
  }

  return { kind: "none" };
}
