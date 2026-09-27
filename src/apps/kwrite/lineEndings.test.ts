import { describe, expect, it } from "vitest";
import { detectKWriteLineEnding, normalizeKWriteEditorText, serializeKWriteEditorText } from "./lineEndings";

describe("KWrite line endings", () => {
  it("detects empty, uniform, and mixed line endings", () => {
    expect(detectKWriteLineEnding("")).toBe("none");
    expect(detectKWriteLineEnding("one\ntwo\n")).toBe("lf");
    expect(detectKWriteLineEnding("one\r\ntwo\r\n")).toBe("crlf");
    expect(detectKWriteLineEnding("one\rtwo\r")).toBe("cr");
    expect(detectKWriteLineEnding("one\ntwo\r\nthree\r")).toBe("mixed");
  });

  it("normalizes textarea text to LF and restores uniform line endings on save", () => {
    expect(normalizeKWriteEditorText("a\r\nb\r\nc")).toBe("a\nb\nc");
    expect(normalizeKWriteEditorText("a\rb\rc")).toBe("a\nb\nc");
    expect(serializeKWriteEditorText("a\nb\n", "lf")).toBe("a\nb\n");
    expect(serializeKWriteEditorText("a\nb\n", "crlf")).toBe("a\r\nb\r\n");
    expect(serializeKWriteEditorText("a\nb\n", "cr")).toBe("a\rb\r");
    expect(serializeKWriteEditorText("Hello", "none")).toBe("Hello");
    expect(serializeKWriteEditorText("第一行\n第二行", "crlf")).toBe("第一行\r\n第二行");
  });
});
