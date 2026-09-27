import { createShellError } from "../errors";
import { formatShellTrashManagementVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, requireShellMutationPort } from "../mutationEnvironment";
import { resolveShellTrashEntryOperand } from "../mutationTargets";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

const confirmationMessage = [
  "permanent-delete: this action cannot be undone",
  "Re-run with --confirm to permanently delete the item.",
].join("\n");

const isConfirmedInvocation = (args: readonly string[]): boolean => args.length === 2 && args[0] === "--confirm";

export const permanentDeleteCommand: ShellCommandDefinition = {
  name: "permanent-delete",
  usage: "permanent-delete [--confirm] <trash-entry>",
  description: "permanently delete a top-level Trash item; requires --confirm",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, invocation, vfsState } = context;

    if (invocation.args.length === 0 || invocation.args.length > 2) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "permanent-delete requires a Trash entry.").message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length === 1 && invocation.args[0] === "--confirm") {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "permanent-delete --confirm requires a Trash entry.").message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length === 2 && invocation.args[0] !== "--confirm") {
      const unsupported = invocation.args.find((arg) => arg.startsWith("-")) ?? invocation.args[1];

      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `permanent-delete: unsupported option: ${unsupported}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length === 1 && invocation.args[0]?.startsWith("-")) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `permanent-delete: unsupported option: ${invocation.args[0]}`).message),
        clearTranscript: false,
      };
    }

    const confirmed = isConfirmedInvocation(invocation.args);
    const operand = confirmed ? invocation.args[1] : invocation.args[0];
    const target = resolveShellTrashEntryOperand(vfsState, cwdNodeId, operand, "permanent-delete");

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(target.error.message),
        clearTranscript: false,
      };
    }

    if (!confirmed) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("CONFIRMATION_REQUIRED", confirmationMessage, {
          commandName: "permanent-delete",
          input: invocation.rawInput,
        }).message),
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

    const deleted = mutations.value.deleteNodePermanently(target.value.nodeId, {
      now: getShellMutationTimestamp(context),
    });

    if (!deleted.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellTrashManagementVfsError("permanent-delete", operand, deleted.error)),
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
