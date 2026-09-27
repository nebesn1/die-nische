import { getVfsPathForNode } from "../../vfs/queries";
import type { VfsNodeId, VfsState } from "../../vfs/types";

export const KONSOLE_PROMPT_USER = "user";
export const KONSOLE_PROMPT_HOST = "kde3";

export function formatKonsolePrompt(path: string): string {
  return `${formatKonsolePromptPrefix(path)}$`;
}

export function formatKonsolePromptPrefix(path: string): string {
  return `${KONSOLE_PROMPT_USER}@${KONSOLE_PROMPT_HOST}:${path}`;
}

export function formatKonsoleWindowTitle(path: string, shellName: string): string {
  return `${formatKonsolePromptPrefix(path)} - ${shellName} - Konsole`;
}

export function getKonsolePromptPath(vfsState: VfsState, cwdNodeId: VfsNodeId): string {
  const path = getVfsPathForNode(vfsState, cwdNodeId);

  return path.ok ? path.value : "(unavailable)";
}
