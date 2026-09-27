import type { CSSProperties, RefObject } from "react";
import type { ShellCompletionCandidate } from "../../shell";
import type { ShellSessionState } from "../../shell/types";
import { KonsoleCommandInput } from "./KonsoleCommandInput";
import { KonsoleCompletionCandidates } from "./KonsoleCompletionCandidates";
import { KonsolePrompt } from "./KonsolePrompt";
import { KonsoleTranscript } from "./KonsoleTranscript";
import type { KonsoleSchema } from "./konsoleSchemas";

interface KonsoleTerminalProps {
  readonly session: ShellSessionState;
  readonly currentPromptPath: string;
  readonly draft: string;
  readonly completionCandidates: readonly ShellCompletionCandidate[];
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly transcriptViewportRef: RefObject<HTMLDivElement | null>;
  readonly onDraftChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onHistoryPrevious: () => void;
  readonly onHistoryNext: () => void;
  readonly onComplete: (input: HTMLInputElement) => void;
  readonly onClearTranscriptShortcut: (input: HTMLInputElement) => void;
  readonly onClearCompletion: () => void;
  readonly onEscape: () => boolean;
  readonly onMultilinePaste: (input: HTMLInputElement, clipboardText: string) => void;
  readonly schema: KonsoleSchema;
  readonly onTextSelectionChange: () => void;
}

export function KonsoleTerminal({
  session,
  currentPromptPath,
  draft,
  completionCandidates,
  inputRef,
  transcriptViewportRef,
  onDraftChange,
  onSubmit,
  onHistoryPrevious,
  onHistoryNext,
  onComplete,
  onClearTranscriptShortcut,
  onClearCompletion,
  onEscape,
  onMultilinePaste,
  schema,
  onTextSelectionChange,
}: KonsoleTerminalProps) {
  const focusInput = (target: EventTarget, currentTarget: EventTarget) => {
    if (target === currentTarget) {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="konsole-terminal"
      data-konsole-terminal
      onClick={(event) => focusInput(event.target, event.currentTarget)}
      onMouseUp={onTextSelectionChange}
      onKeyUp={onTextSelectionChange}
      style={{
        "--konsole-terminal-foreground": schema.foreground,
        "--konsole-terminal-background": schema.background,
        "--konsole-terminal-prompt": schema.prompt,
        "--konsole-terminal-stderr": schema.stderr,
        "--konsole-terminal-system": schema.system,
        "--konsole-terminal-completion": schema.completion,
        "--konsole-terminal-selection": "#3b6ea5",
      } as CSSProperties}
    >
      <div
        ref={transcriptViewportRef}
        className="konsole-transcript-viewport"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <KonsoleTranscript entries={session.transcript} />
      </div>
      <KonsoleCompletionCandidates candidates={completionCandidates} />
      <div className="konsole-input-line">
        <KonsolePrompt path={currentPromptPath} />
        <KonsoleCommandInput
          ref={inputRef}
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          onHistoryPrevious={onHistoryPrevious}
          onHistoryNext={onHistoryNext}
          onComplete={onComplete}
          onClearTranscriptShortcut={onClearTranscriptShortcut}
          onClearCompletion={onClearCompletion}
          onEscape={onEscape}
          onMultilinePaste={onMultilinePaste}
        />
      </div>
    </div>
  );
}
