import type { VfsError } from "../../vfs/errors";
import { resolveVfsPath } from "../../vfs/queries";
import { parseShellFindArguments } from "../findArguments";
import { stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { walkVfsTree } from "../vfsTraversal";

const formatFindError = (path: string, error: VfsError): string =>
  error.code === "NOT_FOUND" || error.code === "NOT_DIRECTORY"
    ? `find: no such file or directory: ${path}`
    : `find: ${error.message}`;

export const findCommand: ShellCommandDefinition = {
  name: "find",
  usage: "find [path] [-name <literal-name>]",
  description: "walk the VFS; -name matches an exact literal basename without glob patterns",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    const parsed = parseShellFindArguments(invocation.args);
    if (!parsed.ok) return { exitCode: 2, cwdNodeId, output: stderr(parsed.error.message), clearTranscript: false };

    const start = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, parsed.value.startPath), cwdPath);
    if (!start.ok) return { exitCode: 1, cwdNodeId, output: stderr(formatFindError(parsed.value.startPath, start.error)), clearTranscript: false };

    const walked = walkVfsTree(vfsState, start.value.id);
    if (!walked.ok) return { exitCode: 1, cwdNodeId, output: stderr(`find: ${walked.error.message}`), clearTranscript: false };

    const output = walked.value
      .filter(({ node }) => parsed.value.name === null || node.name === parsed.value.name)
      .map(({ path }) => `${path}\n`)
      .join("");
    return { exitCode: 0, cwdNodeId, output: stdout(output), clearTranscript: false };
  },
};
