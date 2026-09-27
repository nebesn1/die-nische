import { createInitialShellSession } from "../../shell";
import type { ShellSessionState } from "../../shell";
import type { VfsState } from "../../vfs/types";
import { initialKonsoleCompletionState, type KonsoleCompletionState } from "./completionState";
import { initialKonsoleHistoryNavigationState } from "./historyNavigation";
import { initialKonsolePasteQueueState, type KonsolePasteQueueState } from "./pasteQueue";
import type { KonsoleHistoryNavigationState } from "./konsoleTypes";
import type { KonsoleSelectionRequest } from "./selectionRequest";

export type KonsoleShellSessionId = `shell-${number}`;

export interface KonsoleShellSession {
  readonly id: KonsoleShellSessionId;
  readonly slotNumber: number;
  readonly name: string;
  readonly shell: ShellSessionState;
  readonly draft: string;
  readonly historyNavigation: KonsoleHistoryNavigationState;
  readonly completionState: KonsoleCompletionState;
  readonly selectionRequest: KonsoleSelectionRequest | null;
  readonly pasteQueue: KonsolePasteQueueState;
  readonly hasTextSelection: boolean;
}

export interface KonsoleShellWindowState {
  readonly sessions: readonly KonsoleShellSession[];
  readonly activeSessionId: KonsoleShellSessionId;
  readonly initialWorkingDirectory?: string;
  readonly nextSessionId: number;
}

const defaultShellName = (slotNumber: number): string => slotNumber === 1 ? "Shell" : `Shell No. ${slotNumber}`;

const createShellSession = (
  id: KonsoleShellSessionId,
  slotNumber: number,
  vfsState: VfsState,
  initialWorkingDirectory?: string,
): KonsoleShellSession => ({
  id,
  slotNumber,
  name: defaultShellName(slotNumber),
  shell: createInitialShellSession(vfsState, initialWorkingDirectory),
  draft: "",
  historyNavigation: initialKonsoleHistoryNavigationState,
  completionState: initialKonsoleCompletionState,
  selectionRequest: null,
  pasteQueue: initialKonsolePasteQueueState,
  hasTextSelection: false,
});

export function createInitialKonsoleShellWindowState(
  vfsState: VfsState,
  initialWorkingDirectory?: string,
): KonsoleShellWindowState {
  const first = createShellSession("shell-1", 1, vfsState, initialWorkingDirectory);

  return {
    sessions: [first],
    activeSessionId: first.id,
    initialWorkingDirectory,
    nextSessionId: 2,
  };
}

export function getActiveKonsoleShellSession(state: KonsoleShellWindowState): KonsoleShellSession {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? state.sessions[0]!;
}

export function getNextKonsoleShellSlotNumber(state: KonsoleShellWindowState): number {
  const occupied = new Set(state.sessions.map((session) => session.slotNumber));
  let candidate = 1;

  while (occupied.has(candidate)) {
    candidate += 1;
  }

  return candidate;
}

export function addKonsoleShellSession(state: KonsoleShellWindowState, vfsState: VfsState): KonsoleShellWindowState {
  const id = `shell-${state.nextSessionId}` as KonsoleShellSessionId;
  const session = createShellSession(id, getNextKonsoleShellSlotNumber(state), vfsState, state.initialWorkingDirectory);

  return {
    ...state,
    sessions: [...state.sessions, session],
    activeSessionId: session.id,
    nextSessionId: state.nextSessionId + 1,
  };
}

export function selectKonsoleShellSession(
  state: KonsoleShellWindowState,
  sessionId: KonsoleShellSessionId,
): KonsoleShellWindowState {
  return state.sessions.some((session) => session.id === sessionId) ? { ...state, activeSessionId: sessionId } : state;
}

export function updateKonsoleShellSession(
  state: KonsoleShellWindowState,
  sessionId: KonsoleShellSessionId,
  update: (session: KonsoleShellSession) => KonsoleShellSession,
): KonsoleShellWindowState {
  let changed = false;
  const sessions = state.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const next = update(session);
    changed ||= next !== session;
    return next;
  });

  return changed ? { ...state, sessions } : state;
}

export function renameKonsoleShellSession(
  state: KonsoleShellWindowState,
  sessionId: KonsoleShellSessionId,
  name: string,
): KonsoleShellWindowState {
  return updateKonsoleShellSession(state, sessionId, (session) => session.name === name ? session : { ...session, name });
}

export function closeKonsoleShellSession(
  state: KonsoleShellWindowState,
  sessionId: KonsoleShellSessionId,
): KonsoleShellWindowState {
  if (state.sessions.length <= 1 || !state.sessions.some((session) => session.id === sessionId)) {
    return state;
  }

  const closedIndex = state.sessions.findIndex((session) => session.id === sessionId);
  const sessions = state.sessions.filter((session) => session.id !== sessionId);
  const fallback = sessions[Math.max(0, closedIndex - 1)] ?? sessions[0]!;

  return {
    ...state,
    sessions,
    activeSessionId: state.activeSessionId === sessionId ? fallback.id : state.activeSessionId,
  };
}

export function normalizeKonsoleShellName(value: string): string | null {
  const name = value.trim();
  return name.length > 0 && name.length <= 64 ? name : null;
}
