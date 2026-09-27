import type { ShellCompletionQuoteMode } from "./types";

const shellSpecialCharacters = new Set([" ", "\t", "\\", "'", "\"", "|", ">", "<", "&", ";", "`", "$", "(", ")"]);

export function encodeShellCompletionValue(value: string, quoteMode: ShellCompletionQuoteMode): string | null {
  if (quoteMode === "single") {
    return value.includes("'") ? null : value;
  }

  if (quoteMode === "double") {
    return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  }

  return Array.from(value)
    .map((character) => (shellSpecialCharacters.has(character) ? `\\${character}` : character))
    .join("");
}
