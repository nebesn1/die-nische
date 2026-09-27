import type { ShellCompletionCandidate } from "../../shell";

export interface KonsoleCompletionState {
  readonly contextKey: string | null;
  readonly candidates: readonly ShellCompletionCandidate[];
}

export const initialKonsoleCompletionState: KonsoleCompletionState = Object.freeze({
  contextKey: null,
  candidates: [],
});

export function setKonsoleCompletionCandidates(
  contextKey: string,
  candidates: readonly ShellCompletionCandidate[],
): KonsoleCompletionState {
  return {
    contextKey,
    candidates,
  };
}

export function clearKonsoleCompletionState(): KonsoleCompletionState {
  return initialKonsoleCompletionState;
}
