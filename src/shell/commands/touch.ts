import { createShellError } from "../errors";
import { formatShellMutationVfsError, stderr } from "../formatting";
import { getShellMutationTimestamp, hasUnsupportedShellOption, requireShellMutationPort } from "../mutationEnvironment";
import { resolveShellCreationTarget } from "../mutationTargets";
import { expandShellPathOperand } from "../path";
import type { ShellCommandDefinition, ShellCommandExecution } from "../types";
import { resolveVfsPath } from "../../vfs/queries";

export const touchCommand: ShellCommandDefinition = {
  name: "touch",
  usage: "touch <path>",
  description: "create an empty UTF-8 text file if it does not exist",
  execute(context): ShellCommandExecution {
    const { cwdNodeId, cwdPath, invocation, vfsState } = context;

    const unsupportedOption = hasUnsupportedShellOption(invocation.args);

    if (unsupportedOption) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("UNSUPPORTED_OPTION", `touch: unsupported option: ${unsupportedOption}`).message),
        clearTranscript: false,
      };
    }

    if (invocation.args.length !== 1) {
      return {
        exitCode: 2,
        cwdNodeId,
        output: stderr(createShellError("INVALID_ARGUMENT_COUNT", "touch requires exactly one path.").message),
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
    const existing = resolveVfsPath(vfsState, expandShellPathOperand(vfsState, operand), cwdPath);

    if (existing.ok) {
      if (existing.value.kind === "directory") {
        return {
          exitCode: 1,
          cwdNodeId,
          output: stderr("touch: is a directory: " + operand),
          clearTranscript: false,
        };
      }

      return {
        exitCode: 0,
        cwdNodeId,
        output: [],
        clearTranscript: false,
      };
    }

    if (existing.error.code !== "NOT_FOUND") {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("touch", operand, existing.error)),
        clearTranscript: false,
      };
    }

    const target = resolveShellCreationTarget(vfsState, cwdNodeId, operand, "touch");

    if (!target.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(target.error.message),
        clearTranscript: false,
      };
    }

    const created = mutations.value.createTextFile(target.value.parentPath, target.value.name, "", {
      now: getShellMutationTimestamp(context),
      mimeType: "text/plain",
    });

    if (!created.ok) {
      return {
        exitCode: 1,
        cwdNodeId,
        output: stderr(formatShellMutationVfsError("touch", operand, created.error)),
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
