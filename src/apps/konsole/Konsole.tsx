import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { clearShellTranscript, completeShellInput } from "../../shell";
import type { ShellInputExecutionResult, ShellSessionState } from "../../shell";
import type { ShellCompletionCandidate } from "../../shell";
import { useVfs } from "../../vfs/useVfs";
import { clearKonsoleCompletionState, setKonsoleCompletionCandidates } from "./completionState";
import { createKonsoleMutationPort } from "./createKonsoleMutationPort";
import { moveKonsoleHistoryNext, moveKonsoleHistoryPrevious, resetKonsoleHistoryNavigation } from "./historyNavigation";
import { planKonsolePaste } from "./multiLinePaste";
import { KonsoleMenuBar } from "./KonsoleMenuBar";
import { useKonsoleBookmarks } from "./useKonsoleBookmarks";
import { buildKonsoleBookmarkCdCommand, getKonsoleBookmarkDraft } from "./konsoleBookmarkCommand";
import { getKonsoleBookmarksMenuEntries, type KonsoleBookmarksMenuAction } from "./konsoleBookmarksMenuModel";
import { insertKonsoleMenuPaste } from "./konsoleMenuPaste";
import { defaultKonsoleSchemaId, getKonsoleSchema, type KonsoleSchemaId } from "./konsoleSchemas";
import { KonsoleTerminal } from "./KonsoleTerminal";
import { formatKonsoleWindowTitle, getKonsolePromptPath } from "./promptFormatting";
import { KonsoleRenameShellDialog } from "./KonsoleRenameShellDialog";
import { KonsoleShellTabBar } from "./KonsoleShellTabBar";
import {
  addKonsoleShellSession,
  closeKonsoleShellSession,
  createInitialKonsoleShellWindowState,
  getActiveKonsoleShellSession,
  normalizeKonsoleShellName,
  renameKonsoleShellSession,
  selectKonsoleShellSession,
  updateKonsoleShellSession,
  type KonsoleShellSession,
  type KonsoleShellSessionId,
} from "./konsoleShellSessions";
import { submitKonsoleShellInput } from "./submission";
import {
  clampKonsoleSelectionRequest,
  createKonsoleSelectionRequest,
  shouldConsumeKonsoleSelectionRequest,
  type KonsoleSelectionRequest,
} from "./selectionRequest";
import { consumeKonsoleQueuedCommand, enqueueKonsoleCommands, type KonsolePasteQueueState } from "./pasteQueue";
import { KonquerorTextInputDialog } from "../konqueror/KonquerorInputDialog";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";

type KonsoleProps = {
  readonly windowId?: string;
  readonly initialWorkingDirectory?: string;
  readonly onRequestClose?: () => void;
  readonly onRequestNewWindow?: () => void;
  readonly onRequestEditBookmarks?: () => void;
  readonly onRequestAbout?: (appId: "about-konsole" | "about-kde") => void;
  readonly onSetWindowTitle?: (title: string) => void;
};

export function Konsole({ initialWorkingDirectory, windowId, onRequestClose = () => undefined, onRequestNewWindow, onRequestEditBookmarks, onRequestAbout, onSetWindowTitle }: KonsoleProps) {
  const { t } = useI18n();
  const vfs = useVfs();
  const desktopSession = useOptionalDesktopSession();
  const konsoleBookmarks = useKonsoleBookmarks();
  const [shellWindow, setShellWindow] = useState(() => createInitialKonsoleShellWindowState(vfs.state, initialWorkingDirectory));
  const [schemaId, setSchemaId] = useState<KonsoleSchemaId>(defaultKonsoleSchemaId);
  const [renamingSessionId, setRenamingSessionId] = useState<KonsoleShellSessionId | null>(null);
  const [newBookmarkFolderTarget, setNewBookmarkFolderTarget] = useState<string | null | undefined>(undefined);
  const [newBookmarkFolderName, setNewBookmarkFolderName] = useState("");
  const [newBookmarkFolderError, setNewBookmarkFolderError] = useState<TranslationKey | null>(null);
  const mutationPort = useMemo(() => createKonsoleMutationPort(vfs), [vfs]);
  const shellWindowRef = useRef(shellWindow);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const nextSelectionRequestIdRef = useRef(1);
  const processingQueueItemIdRef = useRef<string | null>(null);
  const shouldAnchorTranscriptBottomRef = useRef(false);

  shellWindowRef.current = shellWindow;
  const activeShell = getActiveKonsoleShellSession(shellWindow);
  const session = activeShell.shell;
  const draft = activeShell.draft;
  const historyNavigation = activeShell.historyNavigation;
  const completionState = activeShell.completionState;
  const selectionRequest = activeShell.selectionRequest;
  const pasteQueue = activeShell.pasteQueue;
  const hasTextSelection = activeShell.hasTextSelection;

  const updateShell = useCallback((sessionId: KonsoleShellSessionId, update: (session: KonsoleShellSession) => KonsoleShellSession) => {
    setShellWindow((current) => updateKonsoleShellSession(current, sessionId, update));
  }, []);
  const updateActiveShell = useCallback((update: (session: KonsoleShellSession) => KonsoleShellSession) => {
    setShellWindow((current) => updateKonsoleShellSession(current, current.activeSessionId, update));
  }, []);
  const setSession = useCallback((next: ShellSessionState) => updateActiveShell((current) => current.shell === next ? current : { ...current, shell: next }), [updateActiveShell]);
  const setDraft = useCallback((next: SetStateAction<string>) => updateActiveShell((current) => {
    const draftValue = typeof next === "function" ? next(current.draft) : next;
    return draftValue === current.draft ? current : { ...current, draft: draftValue };
  }), [updateActiveShell]);
  const setHistoryNavigation = useCallback((next: SetStateAction<typeof historyNavigation>) => updateActiveShell((current) => {
    const value = typeof next === "function" ? next(current.historyNavigation) : next;
    return value === current.historyNavigation ? current : { ...current, historyNavigation: value };
  }), [updateActiveShell]);
  const setCompletionState = useCallback((next: SetStateAction<typeof completionState>) => updateActiveShell((current) => {
    const value = typeof next === "function" ? next(current.completionState) : next;
    return value === current.completionState ? current : { ...current, completionState: value };
  }), [updateActiveShell]);
  const setSelectionRequest = useCallback((next: SetStateAction<KonsoleSelectionRequest | null>) => updateActiveShell((current) => {
    const value = typeof next === "function" ? next(current.selectionRequest) : next;
    return value === current.selectionRequest ? current : { ...current, selectionRequest: value };
  }), [updateActiveShell]);
  const setPasteQueue = useCallback((next: SetStateAction<KonsolePasteQueueState>) => updateActiveShell((current) => {
    const value = typeof next === "function" ? next(current.pasteQueue) : next;
    return value === current.pasteQueue ? current : { ...current, pasteQueue: value };
  }), [updateActiveShell]);
  const setHasTextSelection = useCallback((next: SetStateAction<boolean>) => updateActiveShell((current) => {
    const value = typeof next === "function" ? next(current.hasTextSelection) : next;
    return value === current.hasTextSelection ? current : { ...current, hasTextSelection: value };
  }), [updateActiveShell]);
  const createNewShell = useCallback(() => {
    setShellWindow((current) => addKonsoleShellSession(current, vfs.state));
  }, [vfs.state]);
  const requestRenameShell = useCallback((sessionId: KonsoleShellSessionId) => {
    setRenamingSessionId(sessionId);
  }, []);
  const requestRenameActiveShell = useCallback(() => {
    setRenamingSessionId(shellWindowRef.current.activeSessionId);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeShell.id]);

  useLayoutEffect(() => {
    if (selectionRequest === null) {
      return;
    }

    const input = inputRef.current;

    if (input !== null) {
      const selection = clampKonsoleSelectionRequest(selectionRequest, input.value.length);

      input.setSelectionRange(selection.start, selection.end);
    }

    setSelectionRequest((current) =>
      shouldConsumeKonsoleSelectionRequest(current, selectionRequest.requestId),
    );
  }, [selectionRequest, setSelectionRequest]);

  useLayoutEffect(() => {
    if (!shouldAnchorTranscriptBottomRef.current) {
      return;
    }

    const viewport = transcriptViewportRef.current;

    if (viewport !== null) {
      viewport.scrollTop = viewport.scrollHeight;
    }

    shouldAnchorTranscriptBottomRef.current = false;
  }, [completionState.candidates]);

  useEffect(() => {
    const viewport = transcriptViewportRef.current;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [activeShell.id, session.commandHistory.length, session.nextTranscriptEntryId, session.transcript]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setHistoryNavigation(resetKonsoleHistoryNavigation());
    setCompletionState(clearKonsoleCompletionState());
    setSelectionRequest(null);
  };

  const dispatchKonsoleShellCommand = useCallback((sessionId: KonsoleShellSessionId, input: string): ShellInputExecutionResult | null => {
    const target = shellWindowRef.current.sessions.find((candidate) => candidate.id === sessionId);

    if (!target) return null;

    const executed = submitKonsoleShellInput(target.shell, vfs.state, input, {
      mutations: mutationPort,
      now: () => new Date().toISOString(),
    });

    updateShell(sessionId, (current) => ({ ...current, shell: executed.session }));
    return executed;
  }, [mutationPort, updateShell, vfs.state]);

  const bookmarkEntries = useMemo(() => getKonsoleBookmarksMenuEntries(konsoleBookmarks.bookmarks.rootChildren), [konsoleBookmarks.bookmarks.rootChildren]);

  const openKonsoleBookmark = useCallback((bookmarkId: string) => {
    const node = konsoleBookmarks.getNode(bookmarkId);
    if (node?.type !== "bookmark") return;
    const executed = dispatchKonsoleShellCommand(shellWindowRef.current.activeSessionId, buildKonsoleBookmarkCdCommand(node.location));
    if (executed?.execution?.exitCode === 0) {
      konsoleBookmarks.recordVisit(node.id);
    }
  }, [dispatchKonsoleShellCommand, konsoleBookmarks]);

  const addKonsoleBookmark = useCallback((parentId: string | null) => {
    const target = shellWindowRef.current.sessions.find((candidate) => candidate.id === shellWindowRef.current.activeSessionId);
    if (!target) return;
    const draft = getKonsoleBookmarkDraft(vfs.state, target.shell);
    if (draft !== null) konsoleBookmarks.addBookmark(draft, parentId);
  }, [konsoleBookmarks, vfs.state]);

  const openNewKonsoleBookmarkFolder = useCallback((parentId: string | null) => {
    setNewBookmarkFolderTarget(parentId);
    setNewBookmarkFolderName("");
    setNewBookmarkFolderError(null);
  }, []);

  const submitNewKonsoleBookmarkFolder = useCallback(() => {
    if (newBookmarkFolderTarget === undefined) return;
    const name = newBookmarkFolderName.trim();
    if (name.length === 0) {
      setNewBookmarkFolderError("konsole.enterFolderName");
      return;
    }
    const result = konsoleBookmarks.addFolder({ name }, newBookmarkFolderTarget);
    if (!result.ok) {
      setNewBookmarkFolderError("konsole.folderUnavailable");
      return;
    }
    setNewBookmarkFolderTarget(undefined);
  }, [konsoleBookmarks, newBookmarkFolderName, newBookmarkFolderTarget]);

  const handleKonsoleBookmarkAction = useCallback((action: KonsoleBookmarksMenuAction) => {
    switch (action.type) {
      case "add-bookmark":
        addKonsoleBookmark(action.parentId);
        return;
      case "edit-bookmarks":
        onRequestEditBookmarks?.();
        return;
      case "new-folder":
        openNewKonsoleBookmarkFolder(action.parentId);
        return;
      case "open-bookmark":
        openKonsoleBookmark(action.bookmarkId);
        return;
    }
  }, [addKonsoleBookmark, onRequestEditBookmarks, openKonsoleBookmark, openNewKonsoleBookmarkFolder]);

  const submitDraft = () => {
    if (pasteQueue.items.length > 0) {
      setPasteQueue((current) => enqueueKonsoleCommands(current, [draft]));
    } else {
      dispatchKonsoleShellCommand(activeShell.id, draft);
    }

    setDraft("");
    setHistoryNavigation(resetKonsoleHistoryNavigation());
    setCompletionState(clearKonsoleCompletionState());
    setSelectionRequest(null);
  };

  useEffect(() => {
    const queued = pasteQueue.items[0];

    const queueKey = `${activeShell.id}:${queued?.id ?? ""}`;
    if (!queued || processingQueueItemIdRef.current === queueKey) {
      return;
    }

    processingQueueItemIdRef.current = queueKey;
    dispatchKonsoleShellCommand(activeShell.id, queued.input);
    setPasteQueue((current) => consumeKonsoleQueuedCommand(current, queued.id));
  }, [activeShell.id, dispatchKonsoleShellCommand, pasteQueue, setPasteQueue]);

  const requestInputSelection = (start: number, end = start) => {
    const requestId = nextSelectionRequestIdRef.current;

    nextSelectionRequestIdRef.current += 1;
    setSelectionRequest(createKonsoleSelectionRequest(requestId, start, end));
  };

  const applyProgrammaticDraft = (nextDraft: string, caretPosition: number) => {
    setDraft(nextDraft);
    requestInputSelection(caretPosition);
  };

  const showPreviousHistory = () => {
    const next = moveKonsoleHistoryPrevious(historyNavigation, session.commandHistory, draft);

    setHistoryNavigation(next.state);
    applyProgrammaticDraft(next.draft, next.draft.length);
    setCompletionState(clearKonsoleCompletionState());
  };

  const showNextHistory = () => {
    const next = moveKonsoleHistoryNext(historyNavigation, session.commandHistory, draft);

    setHistoryNavigation(next.state);
    applyProgrammaticDraft(next.draft, next.draft.length);
    setCompletionState(clearKonsoleCompletionState());
  };

  const setCompletionCandidates = (contextKey: string, candidates: readonly ShellCompletionCandidate[]) => {
    setCompletionState(
      candidates.length > 0
        ? setKonsoleCompletionCandidates(contextKey, candidates)
        : clearKonsoleCompletionState(),
    );
  };

  const handleComplete = (input: HTMLInputElement) => {
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;

    if (selectionStart === null || selectionEnd === null) {
      setCompletionState(clearKonsoleCompletionState());
      return;
    }

    if (selectionStart !== selectionEnd) {
      setCompletionState(clearKonsoleCompletionState());
      return;
    }

    const transcriptViewport = transcriptViewportRef.current;
    shouldAnchorTranscriptBottomRef.current = transcriptViewport !== null
      && transcriptViewport.scrollTop + transcriptViewport.clientHeight >= transcriptViewport.scrollHeight - 1;

    const result = completeShellInput(session, vfs.state, draft, selectionStart);

    if (result.changed) {
      applyProgrammaticDraft(result.draft, result.cursorPosition);
    } else {
      setSelectionRequest(null);
    }

    setCompletionCandidates(result.contextKey, result.candidates);
    setHistoryNavigation(resetKonsoleHistoryNavigation());
  };

  const handleClearTranscriptShortcut = (input: HTMLInputElement) => {
    const caretPosition = input.selectionStart ?? draft.length;

    const nextSession = clearShellTranscript(session);

    setSession(nextSession);
    setCompletionState(clearKonsoleCompletionState());
    setSelectionRequest(null);
    input.setSelectionRange(caretPosition, caretPosition);
  };

  const handleClearCompletion = () => {
    setCompletionState(clearKonsoleCompletionState());
    setSelectionRequest(null);
  };

  const handleEscape = () => {
    if (completionState.candidates.length === 0) {
      return false;
    }

    setCompletionState(clearKonsoleCompletionState());
    return true;
  };

  const handleMultilinePaste = (input: HTMLInputElement, clipboardText: string) => {
    const plan = planKonsolePaste(draft, input.selectionStart, input.selectionEnd, clipboardText);

    if (!plan.isMultiline) {
      return;
    }

    setPasteQueue((current) => enqueueKonsoleCommands(current, plan.commands));
    setDraft(plan.remainingDraft);
    requestInputSelection(plan.remainingCaretPosition);
    setHistoryNavigation(resetKonsoleHistoryNavigation());
    setCompletionState(clearKonsoleCompletionState());
  };

  const getTerminalSelectionText = useCallback(() => {
    const input = inputRef.current;

    if (input !== null && input.selectionStart !== null && input.selectionEnd !== null && input.selectionStart !== input.selectionEnd) {
      return input.value.slice(input.selectionStart, input.selectionEnd);
    }

    return typeof window === "undefined" ? "" : window.getSelection()?.toString() ?? "";
  }, []);

  const refreshTextSelection = useCallback(() => {
    setHasTextSelection(getTerminalSelectionText().length > 0);
  }, [getTerminalSelectionText, setHasTextSelection]);

  const copyTerminalSelection = () => {
    const selection = getTerminalSelectionText();

    if (selection.length > 0) {
      void desktopSession?.writeClipboard(selection);
    }
  };

  const pasteClipboardText = () => {
    const clipboardText = desktopSession?.readClipboardText();
    const input = inputRef.current;

    if (clipboardText === null || clipboardText === undefined || clipboardText.length === 0 || input === null) {
      return;
    }

    const next = insertKonsoleMenuPaste(
      draft,
      input.selectionStart ?? draft.length,
      input.selectionEnd ?? draft.length,
      clipboardText,
    );

    applyProgrammaticDraft(next.draft, next.caretPosition);
    setHistoryNavigation(resetKonsoleHistoryNavigation());
    setCompletionState(clearKonsoleCompletionState());
    input.focus({ preventScroll: true });
    setHasTextSelection(false);
  };

  const schema = getKonsoleSchema(schemaId);
  const activePromptPath = getKonsolePromptPath(vfs.state, session.cwdNodeId);
  const renamingSession = renamingSessionId === null
    ? null
    : shellWindow.sessions.find((candidate) => candidate.id === renamingSessionId) ?? null;

  useEffect(() => {
    onSetWindowTitle?.(formatKonsoleWindowTitle(activePromptPath, activeShell.name));
  }, [activePromptPath, activeShell.name, onSetWindowTitle]);

  const handleRenameSave = (name: string) => {
    if (renamingSessionId === null) return false;
    const normalized = normalizeKonsoleShellName(name);
    if (normalized === null) return false;
    setShellWindow((current) => renameKonsoleShellSession(current, renamingSessionId, normalized));
    setRenamingSessionId(null);
    return true;
  };

  return (
    <div className="konsole-app" data-konsole-root="true" data-window-id={windowId}>
      <KonsoleMenuBar
        windowId={windowId}
        canCopy={hasTextSelection && desktopSession !== null}
        canPaste={desktopSession?.hasClipboardText ?? false}
        schemaId={schemaId}
        onNewShell={createNewShell}
        onNewWindow={onRequestNewWindow}
        onRenameSession={requestRenameActiveShell}
        onQuit={onRequestClose}
        onCopy={copyTerminalSelection}
        onPaste={pasteClipboardText}
        onSelectSchema={setSchemaId}
        onAboutKonsole={() => onRequestAbout?.("about-konsole")}
        onAboutKde={() => onRequestAbout?.("about-kde")}
        bookmarkEntries={bookmarkEntries}
        onBookmarkAction={handleKonsoleBookmarkAction}
      />
      <KonsoleTerminal
        session={session}
        currentPromptPath={activePromptPath}
        draft={draft}
        completionCandidates={completionState.candidates}
        inputRef={inputRef}
        transcriptViewportRef={transcriptViewportRef}
        onDraftChange={handleDraftChange}
        onSubmit={submitDraft}
        onHistoryPrevious={showPreviousHistory}
        onHistoryNext={showNextHistory}
        onComplete={handleComplete}
        onClearTranscriptShortcut={handleClearTranscriptShortcut}
        onClearCompletion={handleClearCompletion}
        onEscape={handleEscape}
        onMultilinePaste={handleMultilinePaste}
        schema={schema}
        onTextSelectionChange={refreshTextSelection}
      />
      <KonsoleShellTabBar
        sessions={shellWindow.sessions}
        activeSessionId={activeShell.id}
        onNewShell={createNewShell}
        onSelectShell={(sessionId) => setShellWindow((current) => selectKonsoleShellSession(current, sessionId))}
        onRenameShell={requestRenameShell}
        onCloseShell={() => setShellWindow((current) => closeKonsoleShellSession(current, current.activeSessionId))}
      />
      {renamingSession ? (
        <KonsoleRenameShellDialog
          initialName={renamingSession.name}
          onSave={handleRenameSave}
          onCancel={() => setRenamingSessionId(null)}
        />
      ) : null}
      {newBookmarkFolderTarget !== undefined ? (
        <KonquerorTextInputDialog
          title={t("konsole.newBookmarkFolder")}
          label={t("konsole.folderName")}
          value={newBookmarkFolderName}
          error={newBookmarkFolderError === null ? undefined : t(newBookmarkFolderError)}
          onChange={setNewBookmarkFolderName}
          onCancel={() => setNewBookmarkFolderTarget(undefined)}
          onSubmit={submitNewKonsoleBookmarkFolder}
        />
      ) : null}
    </div>
  );
}
