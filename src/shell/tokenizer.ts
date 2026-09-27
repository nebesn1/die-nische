import { createShellError, shellFail, shellOk, type ShellResult } from "./errors";
import type { ShellToken } from "./types";

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

export function tokenizeShellInput(input: string): ShellResult<readonly ShellToken[]> {
  const tokens: ShellToken[] = [];
  let value = "";
  let tokenStarted = false;
  let tokenQuoted = false;
  let quote: "'" | "\"" | null = null;

  const pushToken = () => {
    if (!tokenStarted) {
      return;
    }

    tokens.push({
      value,
      quoted: tokenQuoted,
    });
    value = "";
    tokenStarted = false;
    tokenQuoted = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quote === "'") {
      if (character === "'") {
        quote = null;
        continue;
      }

      value += character;
      tokenStarted = true;
      continue;
    }

    if (quote === "\"") {
      if (character === "\"") {
        quote = null;
        continue;
      }

      if (character === "\\") {
        if (index === input.length - 1) {
          return shellFail(createShellError("PARSE_ERROR", "Trailing backslash in double-quoted string.", { input }));
        }

        index += 1;
        value += input[index];
        tokenStarted = true;
        continue;
      }

      value += character;
      tokenStarted = true;
      continue;
    }

    if (isShellWhitespace(character)) {
      pushToken();
      continue;
    }

    if (isUnsupportedOperator(input, index)) {
      return shellFail(createShellError("UNSUPPORTED_SYNTAX", unsupportedMessage, { input }));
    }

    if (character === "'") {
      quote = "'";
      tokenStarted = true;
      tokenQuoted = true;
      continue;
    }

    if (character === "\"") {
      quote = "\"";
      tokenStarted = true;
      tokenQuoted = true;
      continue;
    }

    if (character === "\\") {
      if (index === input.length - 1) {
        return shellFail(createShellError("PARSE_ERROR", "Trailing backslash.", { input }));
      }

      index += 1;
      value += input[index];
      tokenStarted = true;
      continue;
    }

    value += character;
    tokenStarted = true;
  }

  if (quote === "'") {
    return shellFail(createShellError("PARSE_ERROR", "Unclosed single quote.", { input }));
  }

  if (quote === "\"") {
    return shellFail(createShellError("PARSE_ERROR", "Unclosed double quote.", { input }));
  }

  pushToken();

  return shellOk(tokens);
}
