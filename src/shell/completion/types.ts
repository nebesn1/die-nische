import type { ShellResult } from "../errors";
import type { ShellSessionState } from "../types";
import type { VfsState } from "../../vfs/types";

export type ShellCompletionQuoteMode = "unquoted" | "single" | "double";

export interface ShellCompletionToken {
  readonly value: string;
  readonly rawStart: number;
  readonly rawEnd: number;
  readonly quoteMode: ShellCompletionQuoteMode;
  readonly closed: boolean;
}

export interface ShellCompletionLexResult {
  readonly tokens: readonly ShellCompletionToken[];
  readonly activeTokenIndex: number;
  readonly activeToken: ShellCompletionToken;
}

export type ShellCompletionCandidateKind = "command" | "directory" | "file";

export interface ShellCompletionCandidate {
  readonly value: string;
  readonly displayText: string;
  readonly insertionText: string;
  readonly kind: ShellCompletionCandidateKind;
}

export interface ShellCompletionResult {
  readonly draft: string;
  readonly cursorPosition: number;
  readonly candidates: readonly ShellCompletionCandidate[];
  readonly changed: boolean;
  readonly contextKey: string;
}

export interface CompleteShellInputOptions {
  readonly session: ShellSessionState;
  readonly vfsState: VfsState;
  readonly draft: string;
  readonly cursorPosition: number;
}

export type ShellCompletionLexShellResult = ShellResult<ShellCompletionLexResult>;
