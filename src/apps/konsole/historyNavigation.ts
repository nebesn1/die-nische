import type { KonsoleHistoryNavigationResult, KonsoleHistoryNavigationState } from "./konsoleTypes";

export const initialKonsoleHistoryNavigationState: KonsoleHistoryNavigationState = Object.freeze({
  cursor: null,
  draftBeforeNavigation: "",
});

export function resetKonsoleHistoryNavigation(): KonsoleHistoryNavigationState {
  return initialKonsoleHistoryNavigationState;
}

export function moveKonsoleHistoryPrevious(
  state: KonsoleHistoryNavigationState,
  commandHistory: readonly string[],
  currentDraft: string,
): KonsoleHistoryNavigationResult {
  if (commandHistory.length === 0) {
    return {
      state,
      draft: currentDraft,
    };
  }

  const nextCursor = state.cursor === null ? commandHistory.length - 1 : Math.max(0, state.cursor - 1);

  return {
    state: {
      cursor: nextCursor,
      draftBeforeNavigation: state.cursor === null ? currentDraft : state.draftBeforeNavigation,
    },
    draft: commandHistory[nextCursor] ?? currentDraft,
  };
}

export function moveKonsoleHistoryNext(
  state: KonsoleHistoryNavigationState,
  commandHistory: readonly string[],
  currentDraft: string,
): KonsoleHistoryNavigationResult {
  if (state.cursor === null) {
    return {
      state,
      draft: currentDraft,
    };
  }

  if (state.cursor >= commandHistory.length - 1) {
    return {
      state: resetKonsoleHistoryNavigation(),
      draft: state.draftBeforeNavigation,
    };
  }

  const nextCursor = state.cursor + 1;

  return {
    state: {
      ...state,
      cursor: nextCursor,
    },
    draft: commandHistory[nextCursor] ?? currentDraft,
  };
}
