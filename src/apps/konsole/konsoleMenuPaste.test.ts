import { describe, expect, it } from "vitest";
import { insertKonsoleMenuPaste, normalizeKonsoleMenuPaste } from "./konsoleMenuPaste";

describe("Konsole menu paste", () => {
  it("inserts shared clipboard text at the current caret or selection without submitting it", () => {
    expect(insertKonsoleMenuPaste("abcdef", 3, 3, "XYZ")).toEqual({ draft: "abcXYZdef", caretPosition: 6 });
    expect(insertKonsoleMenuPaste("abcOLDdef", 3, 6, "XYZ")).toEqual({ draft: "abcXYZdef", caretPosition: 6 });
  });

  it("keeps multiline clipboard text inert in the single-line editor", () => {
    expect(normalizeKonsoleMenuPaste("echo first\r\necho second\n")).toBe("echo first echo second ");
  });
});
