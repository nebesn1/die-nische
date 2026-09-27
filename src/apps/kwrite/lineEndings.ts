export type KWriteLineEnding = "lf" | "crlf" | "cr" | "none" | "mixed";

export function detectKWriteLineEnding(content: string): KWriteLineEnding {
  const endings = content.match(/\r\n|\n|\r/g) ?? [];

  if (endings.length === 0) {
    return "none";
  }

  const distinct = new Set(endings);

  if (distinct.size !== 1) {
    return "mixed";
  }

  const [ending] = distinct;

  if (ending === "\r\n") {
    return "crlf";
  }

  return ending === "\r" ? "cr" : "lf";
}

export function normalizeKWriteEditorText(content: string): string {
  return content.replace(/\r\n|\r/g, "\n");
}

export function serializeKWriteEditorText(draft: string, lineEnding: KWriteLineEnding): string {
  if (lineEnding === "crlf") {
    return draft.replace(/\n/g, "\r\n");
  }

  if (lineEnding === "cr") {
    return draft.replace(/\n/g, "\r");
  }

  return draft;
}
