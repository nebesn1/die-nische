import { getPublishedContentSearchTokens, type PublishedContentSearchDocument } from "../../vfs/publishedContentSearch";

export interface SearchTextRange {
  readonly start: number;
  readonly end: number;
}

export interface MatchingTagPresentation {
  readonly tag: string;
  readonly highlights: readonly SearchTextRange[];
}

export interface SearchBodySnippet {
  readonly text: string;
  readonly prefixEllipsis: boolean;
  readonly suffixEllipsis: boolean;
  readonly highlights: readonly SearchTextRange[];
}

export interface PublishedSearchMatchPresentation {
  readonly titleHighlights: readonly SearchTextRange[];
  readonly summaryHighlights: readonly SearchTextRange[];
  readonly matchingTags: readonly MatchingTagPresentation[];
  readonly bodySnippet: SearchBodySnippet | undefined;
}

/** The fixed visible-text budget makes each body explanation deterministic and ranking-free. */
export const publishedSearchSnippetLength = 180;

const normalizeSnippetText = (text: string): string => text.replace(/\s+/gu, " ").trim();

const hasStableLowercaseOffsets = (text: string): boolean => text.toLowerCase().length === text.length;

const mergeRanges = (ranges: readonly SearchTextRange[]): readonly SearchTextRange[] => ranges
  .slice()
  .sort((left, right) => left.start - right.start || left.end - right.end)
  .reduce<SearchTextRange[]>((merged, range) => {
    const previous = merged.at(-1);
    if (previous === undefined || range.start > previous.end) return [...merged, range];
    return [...merged.slice(0, -1), { start: previous.start, end: Math.max(previous.end, range.end) }];
  }, []);

/**
 * Returns literal, case-insensitive source ranges only when ordinary lowercasing preserves
 * code-unit offsets. Eligibility intentionally remains broader for exotic case mappings.
 */
export function getLiteralSearchHighlightRanges(text: string, tokens: readonly string[]): readonly SearchTextRange[] {
  if (text.length === 0 || tokens.length === 0 || !hasStableLowercaseOffsets(text)) return [];

  const lowerText = text.toLowerCase();
  const ranges: SearchTextRange[] = [];
  for (const token of tokens) {
    if (token.length === 0) continue;
    for (let start = lowerText.indexOf(token); start !== -1; start = lowerText.indexOf(token, start + 1)) {
      ranges.push({ start, end: start + token.length });
    }
  }

  return mergeRanges(ranges);
}

const getEarliestLiteralSearchMatch = (text: string, tokens: readonly string[]): number | undefined => {
  if (text.length === 0 || tokens.length === 0 || !hasStableLowercaseOffsets(text)) return undefined;
  const lowerText = text.toLowerCase();
  const matches = tokens.map((token) => lowerText.indexOf(token)).filter((index) => index >= 0);
  return matches.length === 0 ? undefined : Math.min(...matches);
};

const avoidSurrogateSplit = (text: string, offset: number): number => (
  offset > 0 && offset < text.length && /[\uDC00-\uDFFF]/u.test(text[offset]) ? offset + 1 : offset
);

const preferStartBoundary = (text: string, start: number): number => {
  if (start === 0) return 0;
  const boundary = text.lastIndexOf(" ", start - 1);
  return boundary >= 0 && start - boundary <= 24 ? boundary + 1 : avoidSurrogateSplit(text, start);
};

const preferEndBoundary = (text: string, end: number): number => {
  if (end === text.length) return end;
  const boundary = text.indexOf(" ", end);
  return boundary >= 0 && boundary - end <= 24 ? boundary : avoidSurrogateSplit(text, end);
};

export function buildPublishedSearchBodySnippet(
  bodyText: string,
  tokens: readonly string[],
): SearchBodySnippet | undefined {
  const normalizedText = normalizeSnippetText(bodyText);
  const earliestMatch = getEarliestLiteralSearchMatch(normalizedText, tokens);
  if (earliestMatch === undefined) return undefined;

  if (normalizedText.length <= publishedSearchSnippetLength) {
    return {
      text: normalizedText,
      prefixEllipsis: false,
      suffixEllipsis: false,
      highlights: getLiteralSearchHighlightRanges(normalizedText, tokens),
    };
  }

  const initialStart = Math.max(0, earliestMatch - Math.floor(publishedSearchSnippetLength / 2));
  const initialEnd = Math.min(normalizedText.length, initialStart + publishedSearchSnippetLength);
  const adjustedStart = initialEnd === normalizedText.length
    ? Math.max(0, normalizedText.length - publishedSearchSnippetLength)
    : initialStart;
  const start = preferStartBoundary(normalizedText, adjustedStart);
  const end = preferEndBoundary(normalizedText, initialEnd);
  const text = normalizedText.slice(start, end);

  return {
    text,
    prefixEllipsis: start > 0,
    suffixEllipsis: end < normalizedText.length,
    highlights: getLiteralSearchHighlightRanges(text, tokens),
  };
}

/** Builds only visual explanation data for an already eligible document; it cannot filter or reorder. */
export function buildPublishedSearchMatchPresentation(
  document: PublishedContentSearchDocument,
  query: string,
): PublishedSearchMatchPresentation {
  const tokens = getPublishedContentSearchTokens(query);
  const summary = document.entry.summary;
  return {
    titleHighlights: getLiteralSearchHighlightRanges(document.entry.title, tokens),
    summaryHighlights: summary === undefined ? [] : getLiteralSearchHighlightRanges(summary, tokens),
    matchingTags: document.entry.tags.flatMap((tag) => {
      const highlights = getLiteralSearchHighlightRanges(tag, tokens);
      return highlights.length === 0 ? [] : [{ tag, highlights }];
    }),
    bodySnippet: buildPublishedSearchBodySnippet(document.bodyText, tokens),
  };
}
