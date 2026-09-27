import { describe, expect, it } from "vitest";
import { lexShellCompletionInput } from "./partialLexer";

const expectLexed = (input: string, cursor = input.length) => {
  const result = lexShellCompletionInput(input, cursor);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
};

describe("lexShellCompletionInput", () => {
  it("accepts empty and ordinary draft input", () => {
    expect(expectLexed("").activeToken).toEqual({
      value: "",
      rawStart: 0,
      rawEnd: 0,
      quoteMode: "unquoted",
      closed: true,
    });
    expect(expectLexed("cat Documents/Wel").tokens.map((token) => token.value)).toEqual(["cat", "Documents/Wel"]);
  });

  it("tracks the token under the cursor and preserves the replacement range", () => {
    const draft = "cat Documents/Wel other";
    const cursor = "cat Documents/Wel".length;
    const lexed = expectLexed(draft, cursor);

    expect(lexed.activeTokenIndex).toBe(1);
    expect(lexed.activeToken).toMatchObject({
      value: "Documents/Wel",
      rawStart: 4,
      rawEnd: cursor,
      quoteMode: "unquoted",
    });
  });

  it("accepts unclosed single and double quoted tokens", () => {
    expect(expectLexed("cat 'Current Ta").activeToken).toMatchObject({
      value: "Current Ta",
      rawStart: 5,
      quoteMode: "single",
      closed: false,
    });
    expect(expectLexed('cat "Current Ta').activeToken).toMatchObject({
      value: "Current Ta",
      rawStart: 5,
      quoteMode: "double",
      closed: false,
    });
  });

  it("decodes escaped and quoted spaces for completion without using VFS", () => {
    expect(expectLexed(String.raw`cat Current\ Tasks.txt`).activeToken.value).toBe("Current Tasks.txt");
    expect(expectLexed('cat "Current Tasks.txt"').activeToken.value).toBe("Current Tasks.txt");
    expect(expectLexed("cat ''").activeToken).toMatchObject({
      value: "",
      quoteMode: "single",
      closed: true,
    });
  });

  it("allows quoted operators but rejects unquoted shell operators", () => {
    expect(expectLexed("cat 'a|b'").activeToken.value).toBe("a|b");

    const rejected = lexShellCompletionInput("cat a | less", "cat a |".length);

    expect(rejected.ok).toBe(false);
    expect(!rejected.ok ? rejected.error.code : null).toBe("UNSUPPORTED_SYNTAX");
  });
});
