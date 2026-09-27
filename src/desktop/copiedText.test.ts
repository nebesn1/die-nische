import { describe, expect, it } from "vitest";
import { extractCopiedTextFromTarget } from "./copiedText";

describe("internal clipboard text extraction", () => {
  it("uses the exact selected range from inputs and textareas", () => {
    expect(extractCopiedTextFromTarget({ tagName: "INPUT", value: "  Hello KDE  ", selectionStart: 2, selectionEnd: 11 }, "ignored")).toBe("Hello KDE");
    expect(extractCopiedTextFromTarget({ tagName: "textarea", value: " first\nsecond ", selectionStart: 0, selectionEnd: 13 }, "ignored")).toBe(" first\nsecond");
  });

  it("uses normal DOM selection text without trimming it", () => {
    expect(extractCopiedTextFromTarget({ tagName: "div" }, "  Hello KDE  ")).toBe("  Hello KDE  ");
  });

  it("ignores empty control ranges and password fields", () => {
    expect(extractCopiedTextFromTarget({ tagName: "input", value: "Hello", selectionStart: 2, selectionEnd: 2 }, "other selection")).toBe("");
    expect(extractCopiedTextFromTarget({ tagName: "input", type: "password", value: "secret", selectionStart: 0, selectionEnd: 6 }, "secret")).toBe("");
  });
});
