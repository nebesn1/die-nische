import type { VfsError } from "../../vfs/errors";
import { resolveVfsPath } from "../../vfs/queries";
import { stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import { formatShellVfsTree } from "../treeFormatting";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { walkVfsTree } from "../vfsTraversal";

const formatTreeError = (operand: string, error: VfsError): string =>
  error.code === "NOT_FOUND" || error.code === "NOT_DIRECTORY"
    ? `tree: no such file or directory: ${operand}`
    : `tree: ${error.message}`;

export const treeCommand: ShellCommandDefinition = {
  name: "tree",
  usage: "tree [path]",
  description: "display a recursive VFS tree in current child order",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    if (invocation.args.length > 1) {
      return { exitCode: 2, cwdNodeId, output: stderr("tree usage: tree [path]"), clearTranscript: false };
    }

    const operand = invocation.args[0] ?? ".";

    if (operand.startsWith("-")) {
      return { exitCode: 2, cwdNodeId, output: stderr(`tree: unsupported option: ${operand}`), clearTranscript: false };
    }

    const start = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, operand), cwdPath);

    if (!start.ok) {
      return { exitCode: 1, cwdNodeId, output: stderr(formatTreeError(operand, start.error)), clearTranscript: false };
    }

    const walked = walkVfsTree(vfsState, start.value.id);

    if (!walked.ok) {
      return { exitCode: 1, cwdNodeId, output: stderr(`tree: ${walked.error.message}`), clearTranscript: false };
    }

    return { exitCode: 0, cwdNodeId, output: stdout(formatShellVfsTree(walked.value)), clearTranscript: false };
  },
};
