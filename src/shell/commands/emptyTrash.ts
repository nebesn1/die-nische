import { createShellError } from "../errors";
import { stderr } from "../formatting";
import { getShellMutationTimestamp, requireShellMutationPort } from "../mutationEnvironment";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

const confirmationMessage = [
  "empty-trash: this action cannot be undone",
  "Re-run with --confirm to permanently delete all Trash items.",
].join("\n");

export const emptyTrashCommand: ShellCommandDefinition = {
  name: "empty-trash",
  usage: "empty-trash [--confirm]",
  description: "permanently delete all Trash items; requires --confirm",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, invocation } = context;

    if (invocation.args.length === 0) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("CONFIRMATION_REQUIRED", confirmationMessage, {
          commandName: "empty-trash",
          input: invocation.rawInput,
        }).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "empty-trash accepts only --confirm.").message),
        clearTranscript: false,
      };
    }

    if (invocation.args[0] !== "--confirm") {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `empty-trash: unsupported option: ${invocation.args[0]}`).message),
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

    const emptied = mutations.value.emptyTrash({
      now: getShellMutationTimestamp(context),
    });

    if (!emptied.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(`empty-trash: ${emptied.error.message}`),
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
