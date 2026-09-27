export const MAX_CLIPBOARD_HISTORY_ITEMS = 10;

export function addClipboardHistoryItem(history: readonly string[], text: string): readonly string[] {
  if (text.length === 0) {
    return history;
  }

  return [text, ...history.filter((item) => item !== text)].slice(0, MAX_CLIPBOARD_HISTORY_ITEMS);
}

export function clearClipboardHistory(): readonly string[] {
  return [];
}
