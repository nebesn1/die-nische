import { shellCommandDefinitions } from "../commandRegistry";
import { getShellCompletionContext } from "./context";
import { getCommandCompletionCandidates, getHelpTopicCompletionCandidates } from "./commandCompletion";
import { getLongestCommonPrefix } from "./longestCommonPrefix";
import { lexShellCompletionInput } from "./partialLexer";
import { getPathCompletionCandidates } from "./pathCompletion";
import { encodeShellCompletionValue } from "./quoting";
import { getTrashEntryCompletionCandidates } from "./trashEntryCompletion";
import type { ShellCompletionCandidate, ShellCompletionResult } from "./types";
import type { ShellSessionState } from "../types";
import type { VfsState } from "../../vfs/types";

const emptyResult = (draft: string, cursorPosition: number, contextKey: string): ShellCompletionResult => ({
  draft,
  cursorPosition,
  candidates: [],
  changed: false,
  contextKey,
});

const applyReplacement = (
  draft: string,
  replacementStart: number,
  replacementEnd: number,
  replacement: string,
): { readonly draft: string; readonly cursorPosition: number; readonly changed: boolean } => ({
  draft: `${draft.slice(0, replacementStart)}${replacement}${draft.slice(replacementEnd)}`,
  cursorPosition: replacementStart + replacement.length,
  changed: draft.slice(replacementStart, replacementEnd) !== replacement,
});

const getCompletionReplacement = (
  candidates: readonly ShellCompletionCandidate[],
  currentValue: string,
  quoteMode: Parameters<typeof encodeShellCompletionValue>[1],
): string | null => {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0]?.insertionText ?? null;
  }

  const prefix = getLongestCommonPrefix(candidates.map((candidate) => candidate.value));

  if (prefix.length <= currentValue.length) {
    return null;
  }

  return encodeShellCompletionValue(prefix, quoteMode);
};

export function completeShellInput(
  session: ShellSessionState,
  vfsState: VfsState,
  draft: string,
  cursorPosition: number,
): ShellCompletionResult {
  const cursor = Math.max(0, Math.min(cursorPosition, draft.length));
  const lexed = lexShellCompletionInput(draft, cursor);

  if (!lexed.ok) {
    return emptyResult(draft, cursor, `error:${lexed.error.code}:${cursor}`);
  }

  const commandName = lexed.value.tokens[0]?.value ?? null;
  const context = getShellCompletionContext(commandName, lexed.value.activeTokenIndex, lexed.value.tokens);
  const activeToken = lexed.value.activeToken;
  const contextKey = `${context.kind}:${commandName ?? ""}:${lexed.value.activeTokenIndex}:${activeToken.rawStart}:${activeToken.value}`;

  let candidates: readonly ShellCompletionCandidate[] = [];

  if (context.kind === "command") {
    candidates = getCommandCompletionCandidates(activeToken.value);
  } else if (context.kind === "help-topic") {
    candidates = getHelpTopicCompletionCandidates(activeToken.value, activeToken);
  } else if (context.kind === "path") {
    candidates = getPathCompletionCandidates(vfsState, session.cwdNodeId, activeToken, context.filter);
  } else if (context.kind === "trash-entry") {
    candidates = getTrashEntryCompletionCandidates(vfsState, session.cwdNodeId, activeToken);
  } else {
    return emptyResult(draft, cursor, contextKey);
  }

  const replacement = getCompletionReplacement(candidates, activeToken.value, activeToken.quoteMode);

  if (replacement === null) {
    return {
      draft,
      cursorPosition: cursor,
      candidates,
      changed: false,
      contextKey,
    };
  }

  const applied = applyReplacement(draft, activeToken.rawStart, activeToken.rawEnd, replacement);

  return {
    draft: applied.draft,
    cursorPosition: applied.cursorPosition,
    candidates,
    changed: applied.changed,
    contextKey,
  };
}

export function getCompletableShellCommandNames(): readonly string[] {
  return shellCommandDefinitions.map((definition) => definition.name);
}
