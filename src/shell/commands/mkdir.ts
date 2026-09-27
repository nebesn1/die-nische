import { createShellError } from "../errors";
import { formatShellMutationVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, hasUnsupportedShellOption, requireShellMutationPort } from "../mutationEnvironment";
import { resolveShellCreationTarget } from "../mutationTargets";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";

export const mkdirCommand: ShellCommandDefinition = {
  name: "mkdir",
  usage: "mkdir <path>",
  description: "create a directory",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, invocation, vfsState } = context;

    const unsupportedOption = hasUnsupportedShellOption(invocation.args);

    if (unsupportedOption) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `mkdir: unsupported option: ${unsupportedOption}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "mkdir requires exactly one path.").message),
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
    const target = resolveShellCreationTarget(vfsState, cwdNodeId, operand, "mkdir");

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(target.error.message),
        clearTranscript: false,
      };
    }

    const created = mutations.value.createDirectory(target.value.parentPath, target.value.name, {
      now: getShellMutationTimestamp(context),
    });

    if (!created.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("mkdir", operand, created.error)),
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
