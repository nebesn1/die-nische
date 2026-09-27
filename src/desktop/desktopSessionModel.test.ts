import { describe, expect, it } from "vitest";
import { addClipboardHistoryItem, clearClipboardHistory, MAX_CLIPBOARD_HISTORY_ITEMS } from "./desktopSessionModel";

describe("desktop session clipboard history", () => {
  it("keeps session-local text newest-first, deduplicated, and immutable", () => {
    const original = ["older", "duplicate"];
    const next = addClipboardHistoryItem(original, "duplicate");

    expect(next).toEqual(["duplicate", "older"]);
    expect(original).toEqual(["older", "duplicate"]);
    expect(addClipboardHistoryItem(next, "")).toBe(next);
  });

  it("limits history to ten exact text entries and clears only that history", () => {
    const history = Array.from({ length: 12 }, (_, index) => `item-${index}`)
      .reduce<readonly string[]>((current, text) => addClipboardHistoryItem(current, text), []);

    expect(history).toHaveLength(MAX_CLIPBOARD_HISTORY_ITEMS);
    expect(history[0]).toBe("item-11");
    expect(history.at(-1)).toBe("item-2");
    expect(clearClipboardHistory()).toEqual([]);
  });

  it("uses one ordered, deduplicated history for text selections and virtual file URIs", () => {
    const alpha = addClipboardHistoryItem([], "Alpha");
    const file = addClipboardHistoryItem(alpha, "file:///home/user/Documents/A.txt");
    const beta = addClipboardHistoryItem(file, "Beta");

    expect(beta).toEqual(["Beta", "file:///home/user/Documents/A.txt", "Alpha"]);
    expect(addClipboardHistoryItem(beta, "Alpha")).toEqual(["Alpha", "Beta", "file:///home/user/Documents/A.txt"]);
  });
});
