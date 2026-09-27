import { splitPreservedLineEnding, splitTextIntoPreservedLines } from "../../shell";

export interface KonsolePastePlan {
  readonly isMultiline: boolean;
  readonly commands: readonly string[];
  readonly remainingDraft: string;
  readonly remainingCaretPosition: number;
}

const clamp = (value: number, max: number): number => Math.min(Math.max(0, value), max);

const isMultilineText = (text: string): boolean => text.includes("\n") || text.includes("\r");

export function planKonsolePaste(
  draft: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  clipboardText: string,
): KonsolePastePlan {
  const fallbackCaret = draft.length;
  const start = clamp(selectionStart ?? fallbackCaret, draft.length);
  const end = clamp(selectionEnd ?? fallbackCaret, draft.length);
  const replacementStart = Math.min(start, end);
  const replacementEnd = Math.max(start, end);

  if (!isMultilineText(clipboardText)) {
    return {
      isMultiline: false,
      commands: [],
      remainingDraft: draft,
      remainingCaretPosition: replacementStart,
    };
  }

  const combined = `${draft.slice(0, replacementStart)}${clipboardText}${draft.slice(replacementEnd)}`;
  const lines = splitTextIntoPreservedLines(combined);
  const commands: string[] = [];

  for (const line of lines) {
    const { body, terminator } = splitPreservedLineEnding(line);

    if (terminator === "") {
      return {
        isMultiline: true,
        commands,
        remainingDraft: body,
        remainingCaretPosition: body.length - draft.slice(replacementEnd).length,
      };
    }

    commands.push(body);
  }

  return {
    isMultiline: true,
    commands,
    remainingDraft: "",
    remainingCaretPosition: 0,
  };
}
