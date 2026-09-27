import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ShellTranscriptEntry } from "../../shell/types";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { VfsState } from "../../vfs/types";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { VfsProvider } from "../../vfs/VfsProvider";
import { Konsole } from "./Konsole";
import { KonsolePrototype } from "./KonsolePrototype";
import { KonsoleTranscript } from "./KonsoleTranscript";

const renderKonsole = () =>
  renderToStaticMarkup(
    <VfsProvider>
      <Konsole />
    </VfsProvider>,
  );

const createMutableVfsContext = (initialState: VfsState): VfsContextValue => {
  let state = initialState;
  const readState = () => state;
  const commitState = (nextState: VfsState) => {
    state = nextState;
  };
  const operations = createVfsOperations(readState, commitState);

  return {
    get state() {
      return state;
    },
    ...operations,
  };
};

describe("Konsole SSR structure", () => {
  it("renders a KDE-style menu bar and terminal viewport", () => {
    const markup = renderKonsole();

    expect(markup).toContain("aria-label=\"Konsole menu bar\"");
    expect(markup).toContain("Session");
    expect(markup).toContain("role=\"log\"");
    expect(markup).toContain("data-konsole-terminal=\"true\"");
    expect(markup).toContain("aria-label=\"Shell sessions\"");
    expect(markup).toContain("aria-label=\"New Shell\"");
    expect(markup).toContain("Shell");
  });

  it("renders the initial Home prompt and command input", () => {
    const markup = renderKonsole();

    expect(markup).toContain("user@kde3:/home/user$");
    expect(markup).toContain("aria-label=\"Konsole command input\"");
    expect(markup).toContain("type=\"text\"");
  });

  it("uses an explicit working directory for the first prompt without a post-render cd command", () => {
    const markup = renderToStaticMarkup(
      <VfsProvider>
        <Konsole initialWorkingDirectory="/home/user/Documents" />
      </VfsProvider>,
    );

    expect(markup).toContain("user@kde3:/home/user/Documents$");
    expect(markup).not.toContain("cd /home/user/Documents");
  });

  it("consumes a window-scoped working-directory launch request before the first render", () => {
    const markup = renderToStaticMarkup(
      <VfsProvider>
        <KonsolePrototype launchRequest={{
          requestId: 1,
          intent: { type: "open-working-directory", workingDirectory: "/home/user/Documents" },
        }} />
      </VfsProvider>,
    );

    expect(markup).toContain("user@kde3:/home/user/Documents$");
    expect(markup).not.toContain("user@kde3:/home/user$");
  });

  it("does not render textarea, contentEditable, or debug surfaces", () => {
    const markup = renderKonsole();

    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("contentEditable");
    expect(markup).not.toContain("debug");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("<datalist");
  });

  it("renders stdout, stderr, and system chunks with stream-specific attributes", () => {
    const entries: readonly ShellTranscriptEntry[] = [
      {
        id: 7,
        input: "pwd",
        cwdPath: "/home/user",
        exitCode: 1,
        output: [
          { stream: "stdout", text: "/home/user" },
          { stream: "stderr", text: "bad command" },
          { stream: "system", text: "fallback warning" },
        ],
      },
    ];
    const markup = renderToStaticMarkup(<KonsoleTranscript entries={entries} />);

    expect(markup).toContain("data-konsole-stream=\"stdout\"");
    expect(markup).toContain("data-konsole-stream=\"stderr\"");
    expect(markup).toContain("data-konsole-stream=\"system\"");
    expect(markup).toContain("user@kde3:/home/user$");
    expect(markup).toContain("pwd");
  });

  it("renders output as escaped text instead of HTML", () => {
    const entries: readonly ShellTranscriptEntry[] = [
      {
        id: 1,
        input: "cat Script.txt",
        cwdPath: "/home/user",
        exitCode: 0,
        output: [{ stream: "stdout", text: "<script>alert(1)</script>" }],
      },
    ];
    const markup = renderToStaticMarkup(<KonsoleTranscript entries={entries} />);

    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("<script>alert(1)</script>");
  });

  it("does not render empty output blocks", () => {
    const entries: readonly ShellTranscriptEntry[] = [
      {
        id: 2,
        input: "cd Documents",
        cwdPath: "/home/user",
        exitCode: 0,
        output: [],
      },
    ];
    const markup = renderToStaticMarkup(<KonsoleTranscript entries={entries} />);

    expect(markup).not.toContain("konsole-output");
  });

  it("renders prompt-only transcript entries as ordinary selectable command lines", () => {
    const entries: readonly ShellTranscriptEntry[] = [
      {
        id: 3,
        input: "",
        cwdPath: "/home/user/Documents",
        exitCode: 0,
        output: [],
      },
    ];
    const markup = renderToStaticMarkup(<KonsoleTranscript entries={entries} />);

    expect(markup).toContain("user@kde3:/home/user/Documents$");
    expect(markup).not.toContain("konsole-output");
  });

  it("uses the shared VFS provider instead of a private store", () => {
    const context = createMutableVfsContext(createInitialVfsState());
    const created = context.createDirectory("/home/user", "ProviderOnly", {
      now: "2003-04-06T12:30:00.000Z",
    });

    expect(created.ok).toBe(true);

    const markup = renderToStaticMarkup(
      <VfsContext.Provider value={context}>
        <Konsole />
      </VfsContext.Provider>,
    );

    expect(markup).toContain("user@kde3:/home/user$");
    expect(context.state.revision).toBe(1);
  });
});

describe("Konsole source boundaries", () => {
  it("reuses Shell core and VfsProvider without unsafe output APIs", () => {
    const source = readFileSync(new URL("./Konsole.tsx", import.meta.url), "utf8");
    const terminalSource = readFileSync(new URL("./KonsoleTerminal.tsx", import.meta.url), "utf8");
    const transcriptSource = readFileSync(new URL("./KonsoleTranscript.tsx", import.meta.url), "utf8");
    const inputSource = readFileSync(new URL("./KonsoleCommandInput.tsx", import.meta.url), "utf8");

    expect(source).toContain("initialWorkingDirectory");
    expect(source).toContain("submitKonsoleShellInput");
    expect(source).toContain("completeShellInput");
    expect(source).toContain("clearShellTranscript");
    expect(source).toContain("useVfs");
    expect(source).toContain("createInitialKonsoleShellWindowState");
    expect(source).toContain("getActiveKonsoleShellSession");
    expect(source).toContain("updateKonsoleShellSession");
    expect(source).toContain("KonsoleShellTabBar");
    expect(source).toContain("formatKonsoleWindowTitle");
    expect(source).not.toContain("Map<WindowId");
    expect(source).not.toContain("currentKonsole");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("createInitialVfsState");
    expect(terminalSource).toContain("KonsoleCompletionCandidates");
    expect(transcriptSource).not.toContain("dangerouslySetInnerHTML");
    expect(transcriptSource).not.toContain("innerHTML");
    expect(inputSource).toContain("event.key === \"Tab\"");
    expect(inputSource).toContain("event.ctrlKey && event.key.toLowerCase() === \"l\"");
    expect(inputSource).toContain("event.ctrlKey && event.key.toLowerCase() === \"a\"");
    expect(inputSource).toContain("event.ctrlKey && event.key.toLowerCase() === \"e\"");
    expect(inputSource).toContain('event.key === "Home"');
    expect(inputSource).toContain('event.key === "End"');
    expect(inputSource).toContain("!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey");
    expect(inputSource).toContain("isComposing");
    expect(inputSource).toContain("event.clipboardData.getData(\"text/plain\")");
    expect(inputSource).toContain("onMultilinePaste");
    expect(inputSource).not.toContain("navigator.clipboard");
    expect(inputSource).not.toContain('event.key === "Delete"');
    expect(inputSource).not.toContain('event.key === "Backspace"');
    expect(inputSource).not.toContain('event.key.toLowerCase() === "c"');
    expect(inputSource).not.toContain('event.key.toLowerCase() === "x"');
    const submissionSource = readFileSync(new URL("./submission.ts", import.meta.url), "utf8");
    expect(submissionSource).toContain("appendShellPromptOnlyTranscript");
    expect(submissionSource).toContain("executeShellInput");
    expect(submissionSource).not.toContain("createShellCommand");
  });

  it("keeps caret restoration behind one-shot selection requests", () => {
    const source = readFileSync(new URL("./Konsole.tsx", import.meta.url), "utf8");
    const inputSource = readFileSync(new URL("./KonsoleCommandInput.tsx", import.meta.url), "utf8");

    expect(source).toContain("selectionRequest === null");
    expect(source).toContain("}, [selectionRequest, setSelectionRequest]);");
    expect(source).toContain("shouldConsumeKonsoleSelectionRequest");
    expect(source).toContain("if (result.changed)");
    expect(source).toContain("setSelectionRequest(null)");
    expect(source).not.toContain("desiredCaretPositionRef");
    expect(source).not.toContain("}, [draft]);");
    expect(inputSource).not.toContain("document.addEventListener");
    expect(inputSource).not.toContain("execCommand");
    expect(inputSource).not.toContain("setInterval");
    expect(inputSource).not.toContain("setTimeout");
  });

  it("keeps multi-line paste local, queued, and separate from native single-line paste", () => {
    const source = readFileSync(new URL("./Konsole.tsx", import.meta.url), "utf8");
    const inputSource = readFileSync(new URL("./KonsoleCommandInput.tsx", import.meta.url), "utf8");
    const plannerSource = readFileSync(new URL("./multiLinePaste.ts", import.meta.url), "utf8");

    expect(source).toContain("planKonsolePaste");
    expect(source).toContain("enqueueKonsoleCommands");
    expect(source).toContain("consumeKonsoleQueuedCommand");
    expect(source).toContain("processingQueueItemIdRef");
    expect(source).toContain("dispatchKonsoleShellCommand");
    expect(inputSource).toContain("event.preventDefault()");
    expect(inputSource).toContain("!clipboardText.includes(\"\\n\") && !clipboardText.includes(\"\\r\")");
    expect(plannerSource).not.toContain("react");
    expect(plannerSource).not.toContain("executeShellInput");
    expect(plannerSource).not.toContain("navigator.clipboard");
  });

  it("keeps transcript text selectable and avoids custom clipboard behavior", () => {
    const terminalSource = readFileSync(new URL("./KonsoleTerminal.tsx", import.meta.url), "utf8");
    const stylesheet = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

    expect(terminalSource).not.toContain("onCopy");
    expect(terminalSource).not.toContain("onCut");
    expect(stylesheet).toContain(".konsole-terminal {");
    expect(stylesheet).toContain("user-select: text;");
    expect(stylesheet).not.toMatch(/\.konsole-terminal\s*\{[^}]*user-select:\s*none/s);
  });

  it("uses exact-instance menu authorities without restoring View or terminal shortcut scope", () => {
    const source = readFileSync(new URL("./Konsole.tsx", import.meta.url), "utf8");
    const menuSource = readFileSync(new URL("./KonsoleMenuBar.tsx", import.meta.url), "utf8");
    const prototypeSource = readFileSync(new URL("./KonsolePrototype.tsx", import.meta.url), "utf8");

    expect(menuSource).toContain('"session" | "edit" | "view" | "bookmarks" | "settings" | "help"');
    expect(menuSource).toContain("WindowOwnedPopupPortal");
    expect(menuSource).toContain("useApplicationMenuDismissal");
    expect(menuSource).toContain('data-konsole-menu-command="new-window"');
    expect(menuSource).toContain('data-konsole-menu-command="new-shell"');
    expect(menuSource).toContain('data-konsole-menu-command="rename-session"');
    expect(menuSource).toContain('data-konsole-menu-command="quit"');
    expect(menuSource).toContain('data-konsole-menu-command="copy"');
    expect(menuSource).toContain('data-konsole-menu-command="paste"');
    expect(menuSource).toContain('data-konsole-menu-command={entry.action.type}');
    expect(source).toContain("buildKonsoleBookmarkCdCommand");
    expect(source).toContain("dispatchKonsoleShellCommand(shellWindowRef.current.activeSessionId");
    expect(menuSource).toContain('t("konsole.schemaMenu")');
    expect(prototypeSource).toContain('launcher.launchNewApplicationInstance("konsole")');
    expect(prototypeSource).not.toContain('launchApplication("konsole")');
    expect(prototypeSource).toContain("isKonsoleWorkingDirectoryIntent");
    expect(source).toContain("useOptionalDesktopSession");
    expect(source).toContain("insertKonsoleMenuPaste");
    expect(source).toContain("onNewShell={createNewShell}");
    expect(source).toContain("onRenameSession={requestRenameActiveShell}");
    expect(source).not.toContain("navigator.clipboard");
  });

  it("keeps natural transcript flow while constraining completion above a stable input row", () => {
    const source = readFileSync(new URL("./Konsole.tsx", import.meta.url), "utf8");
    const terminalSource = readFileSync(new URL("./KonsoleTerminal.tsx", import.meta.url), "utf8");
    const stylesheet = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");
    const transcriptIndex = terminalSource.indexOf('className="konsole-transcript-viewport"');
    const completionIndex = terminalSource.indexOf("<KonsoleCompletionCandidates");
    const inputIndex = terminalSource.indexOf('className="konsole-input-line"');

    expect(transcriptIndex).toBeGreaterThanOrEqual(0);
    expect(completionIndex).toBeGreaterThan(transcriptIndex);
    expect(inputIndex).toBeGreaterThan(completionIndex);
    expect(terminalSource).toContain("ref={transcriptViewportRef}");
    expect(stylesheet).toMatch(/\.konsole-terminal\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/s);
    expect(stylesheet).toMatch(/\.konsole-transcript-viewport\s*\{[^}]*min-height:\s*0[^}]*flex:\s*0 1 auto[^}]*overflow-y:\s*auto/s);
    expect(stylesheet).not.toMatch(/\.konsole-transcript-viewport\s*\{[^}]*flex:\s*1 1 auto/s);
    expect(stylesheet).toMatch(/\.konsole-completion-candidates\s*\{[^}]*max-height:[^}]*flex:\s*0 1 auto[^}]*overflow-y:\s*auto/s);
    expect(stylesheet).toMatch(/\.konsole-input-line\s*\{[^}]*flex:\s*0 0 auto/s);
    expect(stylesheet).not.toMatch(/\.konsole-input-line\s*\{[^}]*position:\s*(absolute|sticky)[^}]*\}/s);
    expect(source).toContain("shouldAnchorTranscriptBottomRef");
    expect(source).toContain("}, [completionState.candidates]);");
    expect(source).not.toContain("scrollIntoView");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("setInterval");
  });
});
