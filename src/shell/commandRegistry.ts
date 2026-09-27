import { appendCommand } from "./commands/append";
import { basenameCommand } from "./commands/basename";
import { catCommand } from "./commands/cat";
import { cdCommand } from "./commands/cd";
import { clearCommand } from "./commands/clear";
import { cpCommand } from "./commands/cp";
import { dirnameCommand } from "./commands/dirname";
import { echoCommand } from "./commands/echo";
import { emptyTrashCommand } from "./commands/emptyTrash";
import { findCommand } from "./commands/find";
import { grepCommand } from "./commands/grep";
import { headCommand } from "./commands/head";
import { helpCommand } from "./commands/help";
import { historyCommand } from "./commands/history";
import { lsCommand } from "./commands/ls";
import { mkdirCommand } from "./commands/mkdir";
import { mvCommand } from "./commands/mv";
import { permanentDeleteCommand } from "./commands/permanentDelete";
import { pwdCommand } from "./commands/pwd";
import { restoreCommand } from "./commands/restore";
import { tailCommand } from "./commands/tail";
import { statCommand } from "./commands/stat";
import { treeCommand } from "./commands/tree";
import { touchCommand } from "./commands/touch";
import { trashCommand } from "./commands/trash";
import { wcCommand } from "./commands/wc";
import type { ShellCommandDefinition } from "./types";

export const shellCommandDefinitions = Object.freeze([
  pwdCommand,
  cdCommand,
  lsCommand,
  catCommand,
  echoCommand,
  appendCommand,
  headCommand,
  tailCommand,
  wcCommand,
  grepCommand,
  findCommand,
  statCommand,
  basenameCommand,
  dirnameCommand,
  treeCommand,
  mkdirCommand,
  touchCommand,
  cpCommand,
  mvCommand,
  trashCommand,
  restoreCommand,
  permanentDeleteCommand,
  emptyTrashCommand,
  historyCommand,
  clearCommand,
  helpCommand,
]) satisfies readonly ShellCommandDefinition[];

const shellCommandMap: ReadonlyMap<string, ShellCommandDefinition> = new Map(
  shellCommandDefinitions.map((definition) => [definition.name, definition]),
);

export function getShellCommandDefinition(commandName: string): ShellCommandDefinition | undefined {
  return shellCommandMap.get(commandName);
}
