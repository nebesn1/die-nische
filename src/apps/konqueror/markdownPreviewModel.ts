export type MarkdownInlineNode =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "strong" | "emphasis" | "code"; readonly value: string }
  | { readonly type: "link"; readonly label: string; readonly href: string }
  | { readonly type: "image"; readonly alt: string; readonly src: string };

export type MarkdownBlockNode =
  | { readonly type: "heading"; readonly depth: number; readonly content: readonly MarkdownInlineNode[] }
  | { readonly type: "paragraph"; readonly content: readonly MarkdownInlineNode[] }
  | { readonly type: "blockquote"; readonly content: readonly MarkdownInlineNode[] }
  | { readonly type: "list"; readonly ordered: boolean; readonly items: readonly (readonly MarkdownInlineNode[])[] }
  | { readonly type: "html-media"; readonly value: string }
  | { readonly type: "code"; readonly value: string }
  | { readonly type: "rule" };

const inlinePattern = /(!?\[[^\]]*\]\([^)]*\)|`[^`]*`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function parseMarkdownInline(value: string): readonly MarkdownInlineNode[] {
  const output: MarkdownInlineNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      output.push({ type: "text", value: value.slice(cursor, index) });
    }
    const token = match[0];
    if (token.startsWith("![")) {
      const close = token.indexOf("]");
      output.push({ type: "image", alt: token.slice(2, close), src: token.slice(close + 2, -1) });
    } else if (token.startsWith("[")) {
      const close = token.indexOf("]");
      output.push({ type: "link", label: token.slice(1, close), href: token.slice(close + 2, -1) });
    } else if (token.startsWith("`")) {
      output.push({ type: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("**")) {
      output.push({ type: "strong", value: token.slice(2, -2) });
    } else {
      output.push({ type: "emphasis", value: token.slice(1, -1) });
    }
    cursor = index + token.length;
  }
  if (cursor < value.length) {
    output.push({ type: "text", value: value.slice(cursor) });
  }
  return output;
}

const isRule = (line: string): boolean => /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
const mediaOpening = /^\s*<(video|audio)\b/i;

const getCompleteMediaBlockEnd = (lines: readonly string[], start: number): number | null => {
  const opening = mediaOpening.exec(lines[start]);
  if (!opening) return null;
  const closing = new RegExp(`</${opening[1]}\\s*>`, "i");
  for (let index = start; index < lines.length; index += 1) {
    if (closing.test(lines[index])) return index;
  }
  return null;
};

export function parseMarkdownPreview(source: string): readonly MarkdownBlockNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", value: code.join("\n") });
      continue;
    }
    const mediaEnd = getCompleteMediaBlockEnd(lines, index);
    if (mediaEnd !== null) {
      blocks.push({ type: "html-media", value: lines.slice(index, mediaEnd + 1).join("\n") });
      index = mediaEnd + 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", depth: heading[1].length, content: parseMarkdownInline(heading[2]) });
      index += 1;
      continue;
    }
    if (isRule(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", content: parseMarkdownInline(quote.join("\n")) });
      continue;
    }
    const list = /^\s*(?:([-+*])\s+|(\d+)\.\s+)(.+)$/.exec(line);
    if (list) {
      const ordered = Boolean(list[2]);
      const items: (readonly MarkdownInlineNode[])[] = [];
      while (index < lines.length) {
        const item = /^\s*(?:([-+*])\s+|(\d+)\.\s+)(.+)$/.exec(lines[index]);
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(parseMarkdownInline(item[3]));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim().length > 0) {
      if (paragraph.length > 0 && (/^\s*```/.test(lines[index]) || mediaOpening.test(lines[index]) || /^(#{1,6})\s+/.test(lines[index]) || isRule(lines[index]) || /^\s*>\s?/.test(lines[index]) || /^\s*(?:[-+*]\s+|\d+\.\s+)/.test(lines[index]))) {
        break;
      }
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: parseMarkdownInline(paragraph.join("\n")) });
  }
  return blocks;
}
