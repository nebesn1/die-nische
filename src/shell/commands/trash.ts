import { createShellError } from "../errors";
import { formatShellMutationVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, hasUnsupportedShellOption, requireShellMutationPort } from "../mutationEnvironment";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";

export const trashCommand: ShellCommandDefinition = {
  name: "trash",
  usage: "trash <path>",
  description: "move a file or directory to Trash",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, cwdPath, invocation, vfsState } = context;

    const unsupportedOption = hasUnsupportedShellOption(invocation.args);

    if (unsupportedOption) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `trash: unsupported option: ${unsupportedOption}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "trash requires exactly one path.").message),
        clearTranscript: false,
      };
    }

    const mutations = requireShellMutationPort(context);

    if (!mutations.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(mutations.error.message),
        clearTranscript: false,
      };
    }

    const operand = invocation.args[0];
    const source = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, operand), cwdPath);

    if (!source.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("trash", operand, source.error)),
        clearTranscript: false,
      };
    }

    const sourcePath = getVfsPathForNode(vfsState, source.value.id);

    if (!sourcePath.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("trash", operand, sourcePath.error)),
        clearTranscript: false,
      };
    }

    const trashed = mutations.value.moveNodeToTrash(sourcePath.value, {
      now: getShellMutationTimestamp(context),
    });

    if (!trashed.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("trash", operand, trashed.error)),
        clearTranscript: false,
      };
    }

    return {
      exitCode: 0,
      cwdNodeId,
      output: [],
      clearTranscript: false,
    };
  },
};
