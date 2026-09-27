import { createShellError } from "../errors";
import { stderr, stdout } from "../formatting";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export interface ShellHelpEntry {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
}

export const shellHelpEntries: readonly ShellHelpEntry[] = Object.freeze([
  { name: "pwd", usage: "pwd", description: "print the current directory" },
  { name: "cd", usage: "cd [path]", description: "change the current directory" },
  { name: "ls", usage: "ls [path]", description: "list directory contents" },
  { name: "cat", usage: "cat <path>", description: "print a UTF-8 text file" },
  { name: "echo", usage: "echo [text...]", description: "print text without variable or escape expansion" },
  { name: "append", usage: "append <path> <text...>", description: "append one line to an existing UTF-8 text file" },
  { name: "head", usage: "head [-n <count>] <path>", description: "print the first lines of a UTF-8 text file" },
  { name: "tail", usage: "tail [-n <count>] <path>", description: "print the last lines of a UTF-8 text file" },
  {
    name: "wc",
    usage: "wc [-l|-w|-c] <path>",
    description: "count logical text lines, words, or UTF-8 bytes; -l is not POSIX newline counting",
  },
  {
    name: "grep",
    usage: "grep [-i] [-n] <pattern> <path>",
    description: "match literal substrings; regular expressions are not supported",
  },
  {
    name: "find",
    usage: "find [path] [-name <literal-name>]",
    description: "walk the VFS; -name uses exact literal basenames without glob patterns",
  },
  { name: "stat", usage: "stat <path>", description: "show actual VFS metadata for one file or directory" },
  {
    name: "basename",
    usage: "basename <path>",
    description: "return a lexical POSIX basename; the path does not need to exist",
  },
  {
    name: "dirname",
    usage: "dirname <path>",
    description: "return a lexical POSIX dirname; the path does not need to exist",
  },
  { name: "tree", usage: "tree [path]", description: "display a recursive VFS tree in current child order" },
  { name: "mkdir", usage: "mkdir <path>", description: "create a directory" },
  { name: "touch", usage: "touch <path>", description: "create an empty UTF-8 text file if it does not exist" },
  { name: "cp", usage: "cp <source> <destination>", description: "copy a file or directory tree" },
  { name: "mv", usage: "mv <source> <destination>", description: "move or rename a file or directory" },
  { name: "trash", usage: "trash <path>", description: "move a file or directory to Trash" },
  { name: "restore", usage: "restore <trash-entry>", description: "restore a top-level Trash item" },
  {
    name: "permanent-delete",
    usage: "permanent-delete [--confirm] <trash-entry>",
    description: "permanently delete a top-level Trash item; requires --confirm",
  },
  {
    name: "empty-trash",
    usage: "empty-trash [--confirm]",
    description: "permanently delete all Trash items; requires --confirm",
  },
  {
    name: "history",
    usage: "history [count]",
    description: "display current-session commands from oldest to newest; count shows the most recent entries",
  },
  { name: "clear", usage: "clear", description: "clear the shell transcript" },
  { name: "help", usage: "help [command]", description: "show shell help" },
]);

const formatHelpList = (): string => [
  "Supported commands:",
  ...shellHelpEntries.map((entry) => `  ${entry.usage}`),
].join("\n");

const formatHelpEntry = (entry: ShellHelpEntry): string => `${entry.usage} - ${entry.description}`;

export const helpCommand: ShellCommandDefinition = {
  name: "help",
  usage: "help [command]",
  description: "show shell help",
  execute({ cwdNodeId, invocation }): ShellCommandExecution {
    if (invocation.args.length > 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "help accepts at most one command.").message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length === 0) {
      return {
        exitCode: 0,
        cwdNodeId,
        output: stdout(formatHelpList()),
        clearTranscript: false,
      };
    }

    const topic = invocation.args[0];
    const entry = shellHelpEntries.find((candidate) => candidate.name === topic);

    if (!entry) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(`help: no help topic: ${topic}`),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(formatHelpEntry(entry)),
      clearTranscript: false,
    };
  },
};
