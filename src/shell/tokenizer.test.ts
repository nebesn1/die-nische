import { describe, expect, it } from "vitest";
import { parseShellInput } from "./parser";
import { tokenizeShellInput } from "./tokenizer";

const expectTokens = (input: string) => {
  const result = tokenizeShellInput(input);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
};

describe("Shell tokenizer", () => {
  it("handles empty input, words, and whitespace", () => {
    expect(expectTokens("")).toEqual([]);
    expect(expectTokens("cat Notes.txt").map((token) => token.value)).toEqual(["cat", "Notes.txt"]);
    expect(expectTokens("  cat   Notes.txt\tMore.txt\n").map((token) => token.value)).toEqual([
      "cat",
      "Notes.txt",
      "More.txt",
    ]);
  });

  it("handles single quotes, double quotes, empty quotes, and backslash spaces", () => {
    expect(expectTokens("cat 'Current Tasks.txt'")).toEqual([
      { value: "cat", quoted: false },
      { value: "Current Tasks.txt", quoted: true },
    ]);
    expect(expectTokens('cat "Current Tasks.txt"').map((token) => token.value)).toEqual([
      "cat",
      "Current Tasks.txt",
    ]);
    expect(expectTokens("cat '' \"\"").map((token) => token.value)).toEqual(["cat", "", ""]);
    expect(expectTokens("cat Current\\ Tasks.txt").map((token) => token.value)).toEqual([
      "cat",
      "Current Tasks.txt",
    ]);
  });

  it("uses literal backslashes in single quotes and escapes next character in double quotes", () => {
    expect(expectTokens("cat 'A\\ B.txt'").map((token) => token.value)).toEqual(["cat", "A\\ B.txt"]);
    expect(expectTokens('cat "A\\ B.txt"').map((token) => token.value)).toEqual(["cat", "A B.txt"]);
  });

  it("returns parse errors for unclosed quotes and trailing backslashes", () => {
    expect(tokenizeShellInput("cat 'Notes.txt")).toMatchObject({ ok: false, error: { code: "PARSE_ERROR" } });
    expect(tokenizeShellInput('cat "Notes.txt')).toMatchObject({ ok: false, error: { code: "PARSE_ERROR" } });
    expect(tokenizeShellInput("cat Notes.txt\\")).toMatchObject({ ok: false, error: { code: "PARSE_ERROR" } });
  });

  it("rejects unsupported unquoted shell syntax while allowing quoted symbols", () => {
    expect(expectTokens("cat 'Notes|File.txt'").map((token) => token.value)).toEqual(["cat", "Notes|File.txt"]);
    expect(tokenizeShellInput("cat Notes.txt | less")).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SYNTAX" },
    });
    expect(tokenizeShellInput("cat Notes.txt && pwd")).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SYNTAX" },
    });
    expect(tokenizeShellInput("cat Notes.txt > out")).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SYNTAX" },
    });
    expect(tokenizeShellInput("cat $(pwd)")).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SYNTAX" },
    });
    expect(tokenizeShellInput("cat `pwd`")).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SYNTAX" },
    });
  });
});

describe("Shell parser", () => {
  it("extracts invocation fields and preserves raw input", () => {
    expect(parseShellInput("cat Notes.txt")).toEqual({
      ok: true,
      value: {
        commandName: "cat",
        args: ["Notes.txt"],
        rawInput: "cat Notes.txt",
      },
    });
    expect(parseShellInput("   ")).toEqual({ ok: true, value: null });
    expect(parseShellInput("PWD")).toMatchObject({
      ok: true,
      value: { commandName: "PWD", args: [] },
    });
  });
});
