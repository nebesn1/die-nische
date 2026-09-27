import { getVfsTextFileContent } from "../../vfs/fileContent";
import { parseMarkdownDocument } from "../../vfs/markdownFrontMatter";
import type { VfsTextFileNode } from "../../vfs/types";
import { parseSafeHtmlPreview, type SafeHtmlPreviewNode } from "./htmlPreviewModel";
import { parseMarkdownPreview, type MarkdownBlockNode, type MarkdownInlineNode } from "./markdownPreviewModel";
import { getDefaultKonquerorPreviewer } from "./previewModel";

const blockTags = new Set([
  "article", "blockquote", "body", "caption", "dd", "div", "dl", "dt", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "html", "li", "main", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const normalizeDocumentText = (value: string): string => value.replace(/\s+/gu, " ").trim();

const getSafeHtmlText = (nodes: readonly SafeHtmlPreviewNode[]): string => nodes.map((node) => {
  if (node.type === "text") return node.value;
  if (node.type === "image") return "";
  if (node.tag === "br" || node.tag === "hr") return " ";

  const content = getSafeHtmlText(node.children);
  return blockTags.has(node.tag) ? `${content} ` : content;
}).join("");

const getMarkdownInlineText = (nodes: readonly MarkdownInlineNode[]): string => nodes.map((node) => {
  switch (node.type) {
    case "image":
      return "";
    case "link":
      return node.label;
    case "text":
      // Markdown keeps raw HTML inert. Reparse it through the same safe HTML model before indexing text.
      return node.value.includes("<") ? getSafeHtmlText(parseSafeHtmlPreview(node.value)) : node.value;
    default:
      return node.value;
  }
}).join("");

const getMarkdownBlockText = (block: MarkdownBlockNode): string => {
  switch (block.type) {
    case "code":
      return block.value;
    case "list":
      return block.items.map(getMarkdownInlineText).join(" ");
    case "html-media":
      return getSafeHtmlText(parseSafeHtmlPreview(block.value));
    case "rule":
      return "";
    default:
      return getMarkdownInlineText(block.content);
  }
};

/** Pure text projection shared with Konqueror's previewer/parser semantics; it never resolves resources. */
export function getSafeVfsDocumentText(file: VfsTextFileNode): string {
  const source = getVfsTextFileContent(file);
  if (source === null) return "";

  switch (getDefaultKonquerorPreviewer(file)) {
    case "khtml":
      return normalizeDocumentText(getSafeHtmlText(parseSafeHtmlPreview(source)));
    case "markdown":
      return normalizeDocumentText(parseMarkdownPreview(parseMarkdownDocument(source, file.name).body).map(getMarkdownBlockText).join(" "));
    default:
      return source;
  }
}
