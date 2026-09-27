import type { VfsError } from "../../vfs/errors";
import { getVfsPathForNode, listVfsDirectory, resolveVfsPath } from "../../vfs/queries";
import { stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

const formatStatError = (operand: string, error: VfsError): string =>
  error.code === "NOT_FOUND" || error.code === "NOT_DIRECTORY"
    ? `stat: no such file or directory: ${operand}`
    : `stat: ${error.message}`;

export const statCommand: ShellCommandDefinition = {
  name: "stat",
  usage: "stat <path>",
  description: "show actual VFS metadata for one file or directory",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    if (invocation.args.length !== 1) {
      return { exitCode: 2, cwdNodeId, output: stderr("stat usage: stat <path>"), clearTranscript: false };
    }

    const operand = invocation.args[0] ?? "";
    const node = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, operand), cwdPath);

    if (!node.ok) {
      return { exitCode: 1, cwdNodeId, output: stderr(formatStatError(operand, node.error)), clearTranscript: false };
    }

    const path = getVfsPathForNode(vfsState, node.value.id);

    if (!path.ok) {
      return { exitCode: 1, cwdNodeId, output: stderr(`stat: ${path.error.message}`), clearTranscript: false };
    }

    const name = node.value.id === vfsState.rootId ? "/" : node.value.name;
    const common = [`Path: ${path.value}`, `Name: ${name}`, `Type: ${node.value.kind}`, `Created: ${node.value.createdAt}`, `Modified: ${node.value.modifiedAt}`];

    if (node.value.kind === "file") {
      return {
        exitCode: 0,
        cwdNodeId,
        output: stdout([
          ...common.slice(0, 3),
          `Size: ${node.value.size} bytes`,
          `MIME Type: ${node.value.mimeType}`,
          `Encoding: ${node.value.encoding}`,
          ...common.slice(3),
        ].join("\n") + "\n"),
        clearTranscript: false,
      };
    }

    const children = listVfsDirectory(vfsState, path.value);

    if (!children.ok) {
      return { exitCode: 1, cwdNodeId, output: stderr(`stat: ${children.error.message}`), clearTranscript: false };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout([...common.slice(0, 3), `Items: ${children.value.length}`, ...common.slice(3)].join("\n") + "\n"),
      clearTranscript: false,
    };
  },
};
