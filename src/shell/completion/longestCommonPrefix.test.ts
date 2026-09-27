import { describe, expect, it } from "vitest";
import { getLongestCommonPrefix } from "./longestCommonPrefix";

describe("getLongestCommonPrefix", () => {
  it("handles empty, single, identical, partial, and unrelated inputs", () => {
    expect(getLongestCommonPrefix([])).toBe("");
    expect(getLongestCommonPrefix(["Documents"])).toBe("Documents");
    expect(getLongestCommonPrefix(["cat", "cat"])).toBe("cat");
    expect(getLongestCommonPrefix(["clear", "class"])).toBe("cl");
    expect(getLongestCommonPrefix(["pwd", "cat"])).toBe("");
  });

  it("is case-sensitive, deterministic for Unicode, and does not mutate input", () => {
    const values = ["你好.txt", "你好.md"];
    const before = [...values];

    expect(getLongestCommonPrefix(["Cat", "cat"])).toBe("");
    expect(getLongestCommonPrefix(values)).toBe("你好.");
    expect(values).toEqual(before);
  });
});
