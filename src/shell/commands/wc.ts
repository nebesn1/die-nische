import type { VfsError } from "../../vfs/errors";
import { getVfsPathForNode, readVfsTextFile } from "../../vfs/queries";
import { stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import { countShellText } from "../textInspection";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { parseShellWcArguments } from "../wcArguments";

const formatWcError = (path: string, error: VfsError): string => {
  if (error.code === "IS_DIRECTORY") return `wc: is a directory: ${path}`;
  if (error.code === "NOT_FOUND" || error.code === "NOT_DIRECTORY") return `wc: no such file: ${path}`;
  return `wc: ${error.message}`;
};

export const wcCommand: ShellCommandDefinition = {
  name: "wc",
  usage: "wc [-l|-w|-c] <path>",
  description: "count logical lines, words, or UTF-8 bytes in a text file",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    const parsed = parseShellWcArguments(invocation.args);
    if (!parsed.ok) return { exitCode: 2, cwdNodeId, output: stderr(parsed.error.message), clearTranscript: false };

    const file = readVfsTextFile(vfsState, expandShellPathOperand(vfsState, parsed.value.path), cwdPath);
    if (!file.ok) return { exitCode: 1, cwdNodeId, output: stderr(formatWcError(parsed.value.path, file.error)), clearTranscript: false };

    const canonicalPath = getVfsPathForNode(vfsState, file.value.id);
    if (!canonicalPath.ok) return { exitCode: 1, cwdNodeId, output: stderr(`wc: ${canonicalPath.error.message}`), clearTranscript: false };

    const counts = countShellText(file.value.content.text);
    const countText = parsed.value.mode === "lines" ? `${counts.lines}`
      : parsed.value.mode === "words" ? `${counts.words}`
        : parsed.value.mode === "bytes" ? `${counts.bytes}`
          : `${counts.lines} ${counts.words} ${counts.bytes}`;

    return { exitCode: 0, cwdNodeId, output: stdout(`${countText} ${canonicalPath.value}\n`), clearTranscript: false };
  },
};
