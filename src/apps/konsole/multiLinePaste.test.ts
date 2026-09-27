import { describe, expect, it } from "vitest";
import { planKonsolePaste } from "./multiLinePaste";

describe("planKonsolePaste", () => {
  it("leaves single-line text for native browser paste", () => {
    expect(planKonsolePaste('cat ""', 5, 5, "Current Tasks.txt")).toEqual({
      isMultiline: false,
      commands: [],
      remainingDraft: 'cat ""',
      remainingCaretPosition: 5,
    });
  });

  it("plans LF, CRLF, and lone-CR terminated commands without duplicate CRLF entries", () => {
    expect(planKonsolePaste("", 0, 0, "pwd\nls\n")).toEqual({
      isMultiline: true,
      commands: ["pwd", "ls"],
      remainingDraft: "",
      remainingCaretPosition: 0,
    });
    expect(planKonsolePaste("", 0, 0, "pwd\r\nls\r\n").commands).toEqual(["pwd", "ls"]);
    expect(planKonsolePaste("", 0, 0, "pwd\rls\r").commands).toEqual(["pwd", "ls"]);
    expect(planKonsolePaste("", 0, 0, "pwd\n").commands).toEqual(["pwd"]);
    expect(planKonsolePaste("", 0, 0, "pwd\n\n").commands).toEqual(["pwd", ""]);
    expect(planKonsolePaste("", 0, 0, "pwd\r\n\r\n").commands).toEqual(["pwd", ""]);
    expect(planKonsolePaste("", 0, 0, "pwd\r\r").commands).toEqual(["pwd", ""]);
  });

  it("keeps a final unterminated segment in the editable draft", () => {
    expect(planKonsolePaste("", 0, 0, "pwd\nls")).toEqual({
      isMultiline: true,
      commands: ["pwd"],
      remainingDraft: "ls",
      remainingCaretPosition: 2,
    });
  });

  it("preserves blank physical lines for Shell no-op handling", () => {
    expect(planKonsolePaste("", 0, 0, "pwd\n\nls\n").commands).toEqual(["pwd", "", "ls"]);
    expect(planKonsolePaste("", 0, 0, "\necho A\n").commands).toEqual(["", "echo A"]);
  });

  it("merges pasted stream text at the current caret and preserves suffixes", () => {
    expect(planKonsolePaste("echo ", 5, 5, "A\nB")).toEqual({
      isMultiline: true,
      commands: ["echo A"],
      remainingDraft: "B",
      remainingCaretPosition: 1,
    });
    expect(planKonsolePaste("abcXYZ", 3, 3, "1\n2")).toEqual({
      isMultiline: true,
      commands: ["abc1"],
      remainingDraft: "2XYZ",
      remainingCaretPosition: 1,
    });
    expect(planKonsolePaste("abcXYZ", 3, 3, "1\n")).toEqual({
      isMultiline: true,
      commands: ["abc1"],
      remainingDraft: "XYZ",
      remainingCaretPosition: 0,
    });
  });

  it("uses normal selection replacement semantics and retains the caret before suffix text", () => {
    expect(planKonsolePaste("echo OLD suffix", 5, 8, "A\nB")).toEqual({
      isMultiline: true,
      commands: ["echo A"],
      remainingDraft: "B suffix",
      remainingCaretPosition: 1,
    });
    expect(planKonsolePaste("replace", null, null, "你\n🙂")).toEqual({
      isMultiline: true,
      commands: ["replace你"],
      remainingDraft: "🙂",
      remainingCaretPosition: 2,
    });
  });

  it("preserves whitespace, quotes, tabs, operators, and Unicode for the formal Shell parser", () => {
    const plan = planKonsolePaste("", 0, 0, 'echo "A   B"\necho\t你好 | later\n');

    expect(plan.commands).toEqual(['echo "A   B"', "echo\t你好 | later"]);
  });
});
