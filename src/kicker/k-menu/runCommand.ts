import {
  getKonquerorLocationLaunchIntent,
  type KonquerorLocationLaunchIntent,
} from "../../apps/konqueror/locationLaunchIntent";
import { executeShellInput } from "../../shell/execution";
import { expandShellPathOperand } from "../../shell/path";
import { createInitialShellSession } from "../../shell/session";
import type { VfsState } from "../../vfs/types";

const applicationCommands = Object.freeze({
  kwrite: "kwrite",
  konqueror: "konqueror",
  konsole: "konsole",
  kcalc: "kcalc",
  kfind: "kfind",
  kcontrol: "kcontrol",
});

export type RunCommandPlan =
  | { readonly type: "application"; readonly appId: string }
  | { readonly type: "location"; readonly intent: KonquerorLocationLaunchIntent }
  | { readonly type: "shell" }
  | { readonly type: "error"; readonly message: string };

/** Plans only browser-desktop commands; it never delegates to the host OS. */
export function getRunCommandPlan(vfsState: VfsState, input: string): RunCommandPlan {
  const command = input.trim();

  if (command.length === 0) {
    return { type: "error", message: "Enter a command." };
  }

  const appId = applicationCommands[command as keyof typeof applicationCommands];
  if (appId) {
    return { type: "application", appId };
  }

  const location = expandShellPathOperand(vfsState, command);
  const intent = getKonquerorLocationLaunchIntent(vfsState, location);
  if (intent !== null) {
    return { type: "location", intent };
  }

  const result = executeShellInput(createInitialShellSession(vfsState), vfsState, command);
  if (result.execution?.exitCode === 0) {
    return { type: "shell" };
  }

  return {
    type: "error",
    message: result.execution?.output.map((chunk) => chunk.text).join("\n") || "Command could not be run.",
  };
}
