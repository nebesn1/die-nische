export function splitTextIntoPreservedLines(text: string): readonly string[] {
  const lines: string[] = [];
  let start = 0;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === "\n") {
      lines.push(text.slice(start, index + 1));
      index += 1;
      start = index;
      continue;
    }

    if (char === "\r") {
      const end = text[index + 1] === "\n" ? index + 2 : index + 1;

      lines.push(text.slice(start, end));
      index = end;
      start = index;
      continue;
    }

    index += 1;
  }

  if (start < text.length) {
    lines.push(text.slice(start));
  }

  return lines;
}

export interface PreservedTextLine {
  readonly body: string;
  readonly terminator: "" | "\n" | "\r\n" | "\r";
}

export function splitPreservedLineEnding(line: string): PreservedTextLine {
  if (line.endsWith("\r\n")) {
    return { body: line.slice(0, -2), terminator: "\r\n" };
  }

  if (line.endsWith("\n")) {
    return { body: line.slice(0, -1), terminator: "\n" };
  }

  if (line.endsWith("\r")) {
    return { body: line.slice(0, -1), terminator: "\r" };
  }

  return { body: line, terminator: "" };
}

export function takeFirstTextLines(text: string, count: number): string {
  if (count === 0) {
    return "";
  }

  return splitTextIntoPreservedLines(text).slice(0, count).join("");
}

export function takeLastTextLines(text: string, count: number): string {
  if (count === 0) {
    return "";
  }

  const lines = splitTextIntoPreservedLines(text);

  return lines.slice(Math.max(0, lines.length - count)).join("");
}
