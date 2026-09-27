import { createShellError } from "../errors";
import { formatShellMutationVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, hasUnsupportedShellOption, requireShellMutationPort } from "../mutationEnvironment";
import { resolveShellTransferTarget } from "../mutationTargets";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const cpCommand: ShellCommandDefinition = {
  name: "cp",
  usage: "cp <source> <destination>",
  description: "copy a file or directory tree",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, invocation, vfsState } = context;

    const unsupportedOption = hasUnsupportedShellOption(invocation.args);

    if (unsupportedOption) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `cp: unsupported option: ${unsupportedOption}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 2) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "cp requires a source and destination.").message),
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
    const target = resolveShellTransferTarget(vfsState, cwdNodeId, sourceOperand, destinationOperand, "cp");

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(target.error.message),
        clearTranscript: false,
      };
    }

    const copied = mutations.value.copyNode(target.value.sourcePath, target.value.destinationDirectoryPath, {
      now: getShellMutationTimestamp(context),
      newName: target.value.newName,
    });

    if (!copied.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("cp", destinationOperand, copied.error)),
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
