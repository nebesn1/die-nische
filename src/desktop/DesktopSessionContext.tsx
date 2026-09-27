import { useCallback, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useApplicationRuntime } from "../application-runtime/ApplicationRuntimeContext";
import { browserClipboardAdapter, getClipboardWriteFailureMessage, type ClipboardAdapter } from "../kicker/clipboardAdapter";
import { closeShellPopups } from "../shell/shellPopupEvents";
import { useWindowManager } from "../window-manager/useWindowManager";
import { DesktopSessionContext, type DesktopSessionContextValue, type EndSessionDialogState } from "./desktopSessionContext";
import { addClipboardHistoryItem, clearClipboardHistory } from "./desktopSessionModel";

type DesktopSessionMode = "active" | "locked";

type DesktopSessionState = {
  readonly mode: DesktopSessionMode;
  readonly lockedWindowId: string | null;
  readonly endSessionDialog: EndSessionDialogState;
  readonly isClipboardOpen: boolean;
  readonly clipboardHistory: readonly string[];
  readonly currentClipboardText: string | null;
  readonly clipboardStatus: string | null;
  readonly selectionCaptureGeneration: number;
  readonly resetGeneration: number;
};

type DesktopSessionAction =
  | { readonly type: "lock"; readonly windowId: string | null }
  | { readonly type: "unlock" }
  | { readonly type: "open-end-session" }
  | { readonly type: "open-logout" }
  | { readonly type: "request-end-session" }
  | { readonly type: "return-to-end-session-options" }
  | { readonly type: "close-end-session" }
  | { readonly type: "toggle-clipboard" }
  | { readonly type: "close-clipboard" }
  | { readonly type: "record-clipboard-text"; readonly text: string }
  | { readonly type: "write-clipboard-text"; readonly text: string }
  | { readonly type: "clipboard-status"; readonly status: string }
  | { readonly type: "clear-clipboard-history" }
  | { readonly type: "end-session" };

const initialDesktopSessionState: DesktopSessionState = {
  mode: "active",
  lockedWindowId: null,
  endSessionDialog: "closed",
  isClipboardOpen: false,
  clipboardHistory: [],
  currentClipboardText: null,
  clipboardStatus: null,
  selectionCaptureGeneration: 0,
  resetGeneration: 0,
};

const desktopSessionReducer = (state: DesktopSessionState, action: DesktopSessionAction): DesktopSessionState => {
  switch (action.type) {
    case "lock":
      return {
        ...state,
        mode: "locked",
        lockedWindowId: action.windowId,
        endSessionDialog: "closed",
        isClipboardOpen: false,
        selectionCaptureGeneration: state.selectionCaptureGeneration + 1,
      };
    case "unlock":
      return { ...state, mode: "active", lockedWindowId: null };
    case "open-end-session":
      return {
        ...state,
        endSessionDialog: "options",
        isClipboardOpen: false,
        selectionCaptureGeneration: state.selectionCaptureGeneration + 1,
      };
    case "open-logout":
      return {
        ...state,
        endSessionDialog: "logout",
        isClipboardOpen: false,
        selectionCaptureGeneration: state.selectionCaptureGeneration + 1,
      };
    case "request-end-session":
      return { ...state, endSessionDialog: "confirm" };
    case "return-to-end-session-options":
      return { ...state, endSessionDialog: "options" };
    case "close-end-session":
      return { ...state, endSessionDialog: "closed" };
    case "toggle-clipboard":
      return { ...state, isClipboardOpen: !state.isClipboardOpen, clipboardStatus: null };
    case "close-clipboard":
      return state.isClipboardOpen ? { ...state, isClipboardOpen: false } : state;
    case "record-clipboard-text":
      if (action.text.length === 0) {
        return state;
      }

      return {
        ...state,
        currentClipboardText: action.text,
        clipboardHistory: addClipboardHistoryItem(state.clipboardHistory, action.text),
        clipboardStatus: null,
      };
    case "write-clipboard-text":
      return {
        ...state,
        currentClipboardText: action.text.length === 0 ? null : action.text,
        clipboardHistory: addClipboardHistoryItem(state.clipboardHistory, action.text),
        clipboardStatus: null,
      };
    case "clipboard-status":
      return { ...state, clipboardStatus: action.status };
    case "clear-clipboard-history":
      return {
        ...state,
        isClipboardOpen: false,
        clipboardHistory: clearClipboardHistory(),
        clipboardStatus: null,
        selectionCaptureGeneration: state.selectionCaptureGeneration + 1,
      };
    case "end-session":
      return {
        ...initialDesktopSessionState,
        resetGeneration: state.resetGeneration + 1,
        selectionCaptureGeneration: state.selectionCaptureGeneration + 1,
      };
  }
};

export function DesktopSessionProvider({ children, clipboard = browserClipboardAdapter }: { readonly children: ReactNode; readonly clipboard?: ClipboardAdapter }) {
  const { focusWindow, resetSession, windows } = useWindowManager();
  const runtime = useApplicationRuntime();
  const [state, dispatch] = useReducer(desktopSessionReducer, initialDesktopSessionState);
  const currentClipboardTextRef = useRef<string | null>(initialDesktopSessionState.currentClipboardText);

  const lockSession = useCallback(() => {
    closeShellPopups();
    dispatch({ type: "lock", windowId: windows.find((desktopWindow) => desktopWindow.isActive)?.id ?? null });
  }, [windows]);

  const unlockSession = useCallback(() => {
    const windowId = state.lockedWindowId;
    dispatch({ type: "unlock" });
    if (windowId) {
      window.requestAnimationFrame(() => focusWindow(windowId));
    }
  }, [focusWindow, state.lockedWindowId]);

  const openEndSession = useCallback(() => {
    closeShellPopups();
    dispatch({ type: "open-end-session" });
  }, []);
  const openLogout = useCallback(() => {
    closeShellPopups();
    dispatch({ type: "open-logout" });
  }, []);

  const requestEndSession = useCallback(() => dispatch({ type: "request-end-session" }), []);
  const returnToEndSessionOptions = useCallback(() => dispatch({ type: "return-to-end-session-options" }), []);
  const closeEndSession = useCallback(() => dispatch({ type: "close-end-session" }), []);
  const confirmEndSession = useCallback(() => {
    closeShellPopups();
    runtime?.resetApplicationSession?.();
    resetSession?.();
    currentClipboardTextRef.current = null;
    dispatch({ type: "end-session" });
  }, [resetSession, runtime]);

  const toggleClipboard = useCallback(() => {
    if (state.isClipboardOpen) {
      dispatch({ type: "close-clipboard" });
      return;
    }

    closeShellPopups();
    dispatch({ type: "toggle-clipboard" });
  }, [state.isClipboardOpen]);
  const closeClipboard = useCallback(() => dispatch({ type: "close-clipboard" }), []);
  const recordClipboardText = useCallback((text: string) => {
    if (text.length > 0) {
      currentClipboardTextRef.current = text;
    }
    dispatch({ type: "record-clipboard-text", text });
  }, []);
  const readClipboardText = useCallback(() => currentClipboardTextRef.current, []);
  const writeClipboard = useCallback(async (text: string) => {
    currentClipboardTextRef.current = text.length === 0 ? null : text;
    dispatch({ type: "write-clipboard-text", text });

    try {
      await clipboard.writeText(text);
      dispatch({ type: "clipboard-status", status: "Copied to clipboard." });
    } catch {
      dispatch({ type: "clipboard-status", status: getClipboardWriteFailureMessage() });
    }
  }, [clipboard]);
  const clearHistory = useCallback(() => dispatch({ type: "clear-clipboard-history" }), []);

  const value = useMemo<DesktopSessionContextValue>(() => ({
    isLocked: state.mode === "locked",
    endSessionDialog: state.endSessionDialog,
    isClipboardOpen: state.isClipboardOpen,
    clipboardHistory: state.clipboardHistory,
    currentClipboardText: state.currentClipboardText,
    hasClipboardText: state.currentClipboardText !== null && state.currentClipboardText.length > 0,
    clipboardStatus: state.clipboardStatus,
    selectionCaptureGeneration: state.selectionCaptureGeneration,
    resetGeneration: state.resetGeneration,
    lockSession,
    unlockSession,
    openEndSession,
    openLogout,
    requestEndSession,
    returnToEndSessionOptions,
    closeEndSession,
    confirmEndSession,
    toggleClipboard,
    closeClipboard,
    recordClipboardText,
    readClipboardText,
    writeClipboard,
    clearClipboardHistory: clearHistory,
  }), [clearHistory, closeClipboard, closeEndSession, confirmEndSession, lockSession, openEndSession, openLogout, readClipboardText, recordClipboardText, requestEndSession, returnToEndSessionOptions, state, toggleClipboard, unlockSession, writeClipboard]);

  return <DesktopSessionContext.Provider value={value}>{children}</DesktopSessionContext.Provider>;
}
