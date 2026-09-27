import type { VfsError } from "../../vfs/errors";
import { readVfsTextFile } from "../../vfs/queries";
import { stderr, stdout } from "../formatting";
import { parseShellGrepArguments } from "../grepArguments";
import { expandShellPathOperand } from "../path";
import { splitPreservedLineEnding, splitTextIntoPreservedLines } from "../textLines";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

const formatGrepError = (path: string, error: VfsError): string => {
  if (error.code === "IS_DIRECTORY") return `grep: is a directory: ${path}`;
  if (error.code === "NOT_FOUND" || error.code === "NOT_DIRECTORY") return `grep: no such file: ${path}`;
  return `grep: ${error.message}`;
};

export const grepCommand: ShellCommandDefinition = {
  name: "grep",
  usage: "grep [-i] [-n] <pattern> <path>",
  description: "match literal text lines; regular expressions are not supported",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    const parsed = parseShellGrepArguments(invocation.args);
    if (!parsed.ok) return { exitCode: 2, cwdNodeId, output: stderr(parsed.error.message), clearTranscript: false };

    const file = readVfsTextFile(vfsState, expandShellPathOperand(vfsState, parsed.value.path), cwdPath);
    if (!file.ok) return { exitCode: 1, cwdNodeId, output: stderr(formatGrepError(parsed.value.path, file.error)), clearTranscript: false };

    const pattern = parsed.value.ignoreCase ? parsed.value.pattern.toLowerCase() : parsed.value.pattern;
    const matches = splitTextIntoPreservedLines(file.value.content.text).flatMap((line, index): readonly string[] => {
      const { body, terminator } = splitPreservedLineEnding(line);
      const comparableBody = parsed.value.ignoreCase ? body.toLowerCase() : body;
      return comparableBody.includes(pattern)
        ? [`${parsed.value.showLineNumbers ? `${index + 1}:` : ""}${body}${terminator}`]
        : [];
    });

    return { exitCode: matches.length > 0 ? 0 : 1, cwdNodeId, output: stdout(matches.join("")), clearTranscript: false };
  },
};
