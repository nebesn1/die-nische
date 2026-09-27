import { describe, expect, it } from "vitest";
import { takeFirstTextLines, takeLastTextLines, splitTextIntoPreservedLines } from "./textLines";

describe("splitTextIntoPreservedLines", () => {
  it("handles empty text and single lines", () => {
    expect(splitTextIntoPreservedLines("")).toEqual([]);
    expect(splitTextIntoPreservedLines("abc")).toEqual(["abc"]);
    expect(splitTextIntoPreservedLines("abc\n")).toEqual(["abc\n"]);
  });

  it("preserves LF, CRLF, lone CR, empty lines, and Unicode", () => {
    const input = "一\n\n二\r\n三\r四";
    const lines = splitTextIntoPreservedLines(input);

    expect(lines).toEqual(["一\n", "\n", "二\r\n", "三\r", "四"]);
    expect(lines.join("")).toBe(input);
  });

  it("does not create an extra logical line after a trailing line ending", () => {
    expect(splitTextIntoPreservedLines("a\nb\n")).toEqual(["a\n", "b\n"]);
    expect(splitTextIntoPreservedLines("a\r\nb\r\n")).toEqual(["a\r\n", "b\r\n"]);
  });

  it("takes first and last preserved lines without normalizing endings", () => {
    const input = "a\r\nb\nc\rd";

    expect(takeFirstTextLines(input, 2)).toBe("a\r\nb\n");
    expect(takeLastTextLines(input, 2)).toBe("c\rd");
    expect(takeFirstTextLines(input, 0)).toBe("");
    expect(takeLastTextLines(input, 99)).toBe(input);
  });
});
