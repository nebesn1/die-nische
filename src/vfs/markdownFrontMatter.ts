import {
  parseMarkdownFrontMatter as parseRawMarkdownFrontMatter,
  resolveMarkdownFrontMatter as resolveRawMarkdownFrontMatter,
} from "./markdownFrontMatterShared.mjs";
import type { MarkdownFrontMatterPublication } from "./markdownFrontMatterShared.mjs";

export type MarkdownPublicationFrontMatter = {
  readonly title?: string;
  readonly publication?: MarkdownFrontMatterPublication;
};

export type MarkdownDocument = {
  readonly hasFrontMatter: boolean;
  readonly frontMatter: MarkdownPublicationFrontMatter | null;
  readonly body: string;
};

/** Shared runtime/build authoring boundary: metadata is removed before Markdown parsing. */
export function parseMarkdownDocument(rawText: string, sourceLabel = "Markdown document"): MarkdownDocument {
  const parsed = parseRawMarkdownFrontMatter(rawText, sourceLabel);

  if (!parsed.hasFrontMatter) {
    return { hasFrontMatter: false, frontMatter: null, body: parsed.body };
  }

  const resolved = resolveRawMarkdownFrontMatter(parsed.frontMatter, `${sourceLabel} front matter`);
  return {
    hasFrontMatter: true,
    frontMatter: {
      ...(resolved.title === undefined ? {} : { title: resolved.title }),
      ...(resolved.publication === undefined ? {} : { publication: resolved.publication }),
    },
    body: parsed.body,
  };
}

