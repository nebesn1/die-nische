/**
 * The terminal command editor is single-line. Menu paste keeps clipboard text
 * inert by normalizing physical line breaks rather than entering the paste queue.
 */
export function normalizeKonsoleMenuPaste(text: string): string {
  return text.replace(/[\r\n]+/g, " ");
}

export function insertKonsoleMenuPaste(draft: string, start: number, end: number, clipboardText: string) {
  const insertion = normalizeKonsoleMenuPaste(clipboardText);
  const safeStart = Math.min(Math.max(0, start), draft.length);
  const safeEnd = Math.min(Math.max(safeStart, end), draft.length);

  return {
    draft: `${draft.slice(0, safeStart)}${insertion}${draft.slice(safeEnd)}`,
    caretPosition: safeStart + insertion.length,
  };
}
