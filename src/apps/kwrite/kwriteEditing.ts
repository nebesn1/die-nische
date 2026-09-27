export type KWriteSelection = { readonly start: number; readonly end: number };

export type KWriteHistory = { readonly entries: readonly string[]; readonly index: number };

export const createKWriteHistory = (text: string): KWriteHistory => ({ entries: [text], index: 0 });

export function recordKWriteHistory(history: KWriteHistory, text: string): KWriteHistory {
  if (history.entries[history.index] === text) return history;
  return { entries: [...history.entries.slice(0, history.index + 1), text], index: history.index + 1 };
}

export const canUndoKWriteHistory = (history: KWriteHistory) => history.index > 0;
export const canRedoKWriteHistory = (history: KWriteHistory) => history.index < history.entries.length - 1;
export const undoKWriteHistory = (history: KWriteHistory): KWriteHistory => canUndoKWriteHistory(history) ? { ...history, index: history.index - 1 } : history;
export const redoKWriteHistory = (history: KWriteHistory): KWriteHistory => canRedoKWriteHistory(history) ? { ...history, index: history.index + 1 } : history;

export type KWriteSearchOptions = {
  readonly caseSensitive: boolean;
  readonly wholeWords: boolean;
  readonly regularExpression: boolean;
  readonly fromCursor: boolean;
  readonly backwards: boolean;
};

export const defaultKWriteSearchOptions: KWriteSearchOptions = {
  caseSensitive: true, wholeWords: false, regularExpression: false, fromCursor: true, backwards: false,
};

export type KWriteMatch = { readonly start: number; readonly end: number } | null;

function compilePattern(query: string, options: KWriteSearchOptions): RegExp | null {
  if (!query) return null;
  const escaped = options.regularExpression ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = options.wholeWords ? `\\b(?:${escaped})\\b` : escaped;
  try { return new RegExp(source, options.caseSensitive ? "g" : "gi"); } catch { return null; }
}

export function findKWriteMatch(text: string, query: string, options: KWriteSearchOptions, cursor: number): KWriteMatch {
  const pattern = compilePattern(query, options);
  if (!pattern) return null;
  const matches: { start: number; end: number }[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match[0].length === 0) continue;
    matches.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  if (!matches.length) return null;
  if (options.backwards) return [...matches].reverse().find((match) => match.end <= cursor) ?? matches.at(-1) ?? null;
  return matches.find((match) => match.start >= cursor) ?? matches[0] ?? null;
}

export function getKWriteLineSelection(text: string, line: number): KWriteSelection {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) if (text[index] === "\n") starts.push(index + 1);
  const start = starts[Math.max(0, Math.min(line - 1, starts.length - 1))] ?? 0;
  return { start, end: start };
}
