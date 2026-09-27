import { describe, expect, it } from "vitest";
import {
  canRedoKWriteHistory, canUndoKWriteHistory, createKWriteHistory, defaultKWriteSearchOptions,
  findKWriteMatch, getKWriteLineSelection, recordKWriteHistory, redoKWriteHistory, undoKWriteHistory,
} from "./kwriteEditing";

describe("KWrite editing helpers", () => {
  it("keeps instance-local undo and redo branches", () => {
    const initial = createKWriteHistory("");
    const typed = recordKWriteHistory(initial, "abc");
    const undone = undoKWriteHistory(typed);
    expect(canUndoKWriteHistory(typed)).toBe(true);
    expect(undone.entries[undone.index]).toBe("");
    expect(canRedoKWriteHistory(undone)).toBe(true);
    expect(redoKWriteHistory(undone).entries.at(-1)).toBe("abc");
    expect(canRedoKWriteHistory(recordKWriteHistory(undone, "x"))).toBe(false);
  });

  it("finds case-sensitive, whole-word, forward and backward matches without invalid regex crashes", () => {
    const text = "Hello hello concatenate cat";
    expect(findKWriteMatch(text, "hello", defaultKWriteSearchOptions, 0)).toEqual({ start: 6, end: 11 });
    expect(findKWriteMatch(text, "cat", { ...defaultKWriteSearchOptions, wholeWords: true }, 0)).toEqual({ start: 24, end: 27 });
    expect(findKWriteMatch(text, "Hello", { ...defaultKWriteSearchOptions, backwards: true }, text.length)).toEqual({ start: 0, end: 5 });
    expect(findKWriteMatch(text, "[", { ...defaultKWriteSearchOptions, regularExpression: true }, 0)).toBeNull();
  });

  it("resolves a one-based Go to Line caret selection", () => {
    expect(getKWriteLineSelection("one\ntwo\nthree", 3)).toEqual({ start: 8, end: 8 });
    expect(getKWriteLineSelection("one\ntwo", 99)).toEqual({ start: 4, end: 4 });
  });
});
