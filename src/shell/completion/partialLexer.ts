import { createShellError, shellFail, shellOk } from "../errors";
import type {
  ShellCompletionLexShellResult,
  ShellCompletionQuoteMode,
  ShellCompletionToken,
} from "./types";

const isShellWhitespace = (character: string): boolean =>
  character === " " || character === "\t" || character === "\n";

const unsupportedMessage = "Shell operators and command substitution are not supported.";

const isUnsupportedOperator = (input: string, index: number): boolean => {
  const character = input[index];

  return (
    character === "|" ||
    character === ">" ||
    character === "<" ||
    character === "&" ||
    character === ";" ||
    character === "`" ||
    (character === "$" && input[index + 1] === "(")
  );
};

const createToken = (
  value: string,
  rawStart: number,
  rawEnd: number,
  quoteMode: ShellCompletionQuoteMode,
  closed: boolean,
): ShellCompletionToken => ({
  value,
  rawStart,
  rawEnd,
  quoteMode,
  closed,
});

export function lexShellCompletionInput(input: string, cursorPosition: number): ShellCompletionLexShellResult {
  const cursor = Math.max(0, Math.min(cursorPosition, input.length));
  const tokens: ShellCompletionToken[] = [];
  let value = "";
  let tokenStarted = false;
  let rawStart = cursor;
  let quoteMode: ShellCompletionQuoteMode = "unquoted";
  let quote: "'" | "\"" | null = null;
  let tokenClosed = true;

  const pushToken = (rawEnd: number) => {
    if (!tokenStarted) {
      return;
    }

    tokens.push(createToken(value, rawStart, rawEnd, quoteMode, tokenClosed));
    value = "";
    tokenStarted = false;
    rawStart = cursor;
    quoteMode = "unquoted";
    quote = null;
    tokenClosed = true;
  };

  for (let index = 0; index < cursor; index += 1) {
    const character = input[index] ?? "";

    if (quote === "'") {
      if (character === "'") {
        quote = null;
        tokenClosed = true;
        continue;
      }

      value += character;
      tokenStarted = true;
      continue;
    }

    if (quote === "\"") {
      if (character === "\"") {
        quote = null;
        tokenClosed = true;
        continue;
      }

      if (character === "\\" && index < cursor - 1) {
        index += 1;
        value += input[index] ?? "";
        tokenStarted = true;
        continue;
      }

      value += character;
      tokenStarted = true;
      continue;
    }

    if (isShellWhitespace(character)) {
      pushToken(index);
      continue;
    }

    if (isUnsupportedOperator(input, index)) {
      return shellFail(createShellError("UNSUPPORTED_SYNTAX", unsupportedMessage, { input }));
    }

    if (character === "'") {
      if (!tokenStarted) {
        rawStart = index + 1;
        quoteMode = "single";
      }

      quote = "'";
      tokenStarted = true;
      tokenClosed = false;
      continue;
    }

    if (character === "\"") {
      if (!tokenStarted) {
        rawStart = index + 1;
        quoteMode = "double";
      }

      quote = "\"";
      tokenStarted = true;
      tokenClosed = false;
      continue;
    }

    if (character === "\\") {
      if (!tokenStarted) {
        rawStart = index;
      }

      if (index < cursor - 1) {
        index += 1;
        value += input[index] ?? "";
      }

      tokenStarted = true;
      continue;
    }

    if (!tokenStarted) {
      rawStart = index;
      quoteMode = "unquoted";
    }

    value += character;
    tokenStarted = true;
  }

  if (tokenStarted) {
    tokens.push(createToken(value, rawStart, cursor, quoteMode, quote === null && tokenClosed));
  } else {
    tokens.push(createToken("", cursor, cursor, "unquoted", true));
  }

  return shellOk({
    tokens,
    activeTokenIndex: tokens.length - 1,
    activeToken: tokens[tokens.length - 1] ?? createToken("", cursor, cursor, "unquoted", true),
  });
}
