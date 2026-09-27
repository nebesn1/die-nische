import { createShellError } from "../errors";
import { formatShellTrashManagementVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, hasUnsupportedShellOption, requireShellMutationPort } from "../mutationEnvironment";
import { resolveShellTrashEntryOperand } from "../mutationTargets";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const restoreCommand: ShellCommandDefinition = {
  name: "restore",
  usage: "restore <trash-entry>",
  description: "restore a top-level Trash item",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, invocation, vfsState } = context;
    const unsupportedOption = hasUnsupportedShellOption(invocation.args);

    if (unsupportedOption) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `restore: unsupported option: ${unsupportedOption}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "restore requires exactly one Trash entry.").message),
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
    const target = resolveShellTrashEntryOperand(vfsState, cwdNodeId, operand, "restore");

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(target.error.message),
        clearTranscript: false,
      };
    }

    const restored = mutations.value.restoreNodeFromTrash(target.value.nodeId, {
      now: getShellMutationTimestamp(context),
    });

    if (!restored.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellTrashManagementVfsError("restore", operand, restored.error)),
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
