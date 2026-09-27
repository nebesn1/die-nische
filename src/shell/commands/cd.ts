import { createShellError } from "../errors";
import { formatCdVfsError, stderr } from "../formatting";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { getVfsNodeById, getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";

export const cdCommand: ShellCommandDefinition = {
  name: "cd",
  usage: "cd [path]",
  description: "change the current directory",
  execute({ cwdNodeId, cwdPath, invocation, vfsState }): ShellCommandExecution {
    if (invocation.args.length > 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "cd accepts at most one path.").message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length === 0) {
      const home = getVfsNodeById(vfsState, vfsState.specialLocations.home);

      if (home.ok && home.value.kind === "directory") {
        return {
          exitCode: 0,
          cwdNodeId: home.value.id,
          output: [],
          clearTranscript: false,
        };
      }

      return {
        exitCode: 0,
        cwdNodeId: vfsState.rootId,
        output: [],
        clearTranscript: false,
      };
    }

    const requestedPath = invocation.args[0];
    const target = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, requestedPath), cwdPath);

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatCdVfsError(requestedPath, target.error)),
        clearTranscript: false,
      };
    }

    if (target.value.kind !== "directory") {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatCdVfsError(requestedPath, {
          code: "NOT_DIRECTORY",
          message: "Target is not a directory.",
          nodeId: target.value.id,
        })),
        clearTranscript: false,
      };
    }

    const targetPath = getVfsPathForNode(vfsState, target.value.id);

    if (!targetPath.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatCdVfsError(requestedPath, targetPath.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId: target.value.id,
      output: [],
      clearTranscript: false,
    };
  },
};
