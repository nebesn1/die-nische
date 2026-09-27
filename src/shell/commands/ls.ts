import { createShellError } from "../errors";
import { formatLsVfsError, stderr, stdout } from "../formatting";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { listVfsDirectory, resolveVfsPath } from "../../vfs/queries";

export const lsCommand: ShellCommandDefinition = {
  name: "ls",
  usage: "ls [path]",
  description: "list directory contents",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    if (invocation.args.length > 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "ls accepts at most one path.").message),
        clearTranscript: false,
      };
    }

    const requestedPath = invocation.args[0] ?? ".";

    if (requestedPath.startsWith("-")) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `ls: unsupported option: ${requestedPath}`).message),
        clearTranscript: false,
      };
    }

    const expandedPath = expandShellPathOperand(vfsState, requestedPath);
    const target = resolveVfsPath(vfsState, expandedPath, cwdPath);

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatLsVfsError(requestedPath, target.error)),
        clearTranscript: false,
      };
    }

    if (target.value.kind === "file") {
      return {
        exitCode: 0,
        cwdNodeId,
        output: stdout(target.value.name),
        clearTranscript: false,
      };
    }

    const listed = listVfsDirectory(vfsState, expandedPath, cwdPath);

    if (!listed.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatLsVfsError(requestedPath, listed.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: stdout(listed.value.map((node) => (node.kind === "directory" ? `${node.name}/` : node.name)).join("\n")),
      clearTranscript: false,
    };
  },
};
