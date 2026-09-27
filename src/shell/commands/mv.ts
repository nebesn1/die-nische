import { createShellError } from "../errors";
import { formatShellMutationVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, hasUnsupportedShellOption, requireShellMutationPort } from "../mutationEnvironment";
import { resolveShellTransferTarget } from "../mutationTargets";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const mvCommand: ShellCommandDefinition = {
  name: "mv",
  usage: "mv <source> <destination>",
  description: "move or rename a file or directory",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, invocation, vfsState } = context;

    const unsupportedOption = hasUnsupportedShellOption(invocation.args);

    if (unsupportedOption) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `mv: unsupported option: ${unsupportedOption}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 2) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "mv requires a source and destination.").message),
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

    const [sourceOperand, destinationOperand] = invocation.args;
    const target = resolveShellTransferTarget(vfsState, cwdNodeId, sourceOperand, destinationOperand, "mv");

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(target.error.message),
        clearTranscript: false,
      };
    }

    const moved = mutations.value.moveNode(target.value.sourcePath, target.value.destinationDirectoryPath, {
      now: getShellMutationTimestamp(context),
      newName: target.value.newName,
    });

    if (!moved.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("mv", destinationOperand, moved.error)),
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
