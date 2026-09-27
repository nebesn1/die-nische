import { describe, expect, it } from "vitest";
import type { PublishedContentSearchDocument } from "../../vfs/publishedContentSearch";
import {
  buildPublishedSearchBodySnippet,
  buildPublishedSearchMatchPresentation,
  getLiteralSearchHighlightRanges,
  publishedSearchSnippetLength,
  type SearchTextRange,
} from "./publishedSearchMatchPresentation";

const document = ({
  title = "KDE Desktop Journal",
  summary,
  tags = [],
  bodyText = "",
}: {
  readonly title?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly bodyText?: string;
} = {}): PublishedContentSearchDocument => ({
  entry: {
    nodeId: "article",
    canonicalPath: "/home/user/Documents/article.md",
    canonicalName: "article.md",
    title,
    slug: "article",
    aliases: [],
    publishedAt: "2026-09-17T08:00:00.000Z",
    ...(summary === undefined ? {} : { summary }),
    tags,
  },
  bodyText,
});

const reconstruct = (text: string, ranges: readonly SearchTextRange[]): string => {
  let offset = 0;
  return ranges.map((range) => {
    const segment = text.slice(offset, range.start) + text.slice(range.start, range.end);
    offset = range.end;
    return segment;
  }).join("") + text.slice(offset);
};

describe("published Search match presentation", () => {
  it("finds literal case-insensitive occurrences while preserving original casing and visible text", () => {
    const text = "KDE kde KdE";
    const ranges = getLiteralSearchHighlightRanges(text, ["kde"]);

    expect(ranges).toEqual([{ start: 0, end: 3 }, { start: 4, end: 7 }, { start: 8, end: 11 }]);
    expect(reconstruct(text, ranges)).toBe(text);
  });

  it("merges overlapping/repeated token ranges and treats regex-looking query text literally", () => {
    expect(getLiteralSearchHighlightRanges("Web", ["web", "we", "web"])).toEqual([{ start: 0, end: 3 }]);
    expect(getLiteralSearchHighlightRanges("C++ .* [abc]", ["c++", ".*", "[abc]"])).toEqual([
      { start: 0, end: 3 }, { start: 4, end: 6 }, { start: 7, end: 12 },
    ]);
    expect(getLiteralSearchHighlightRanges("KDE", ["qt"])).toEqual([]);
  });

  it("supports ordinary Unicode text and omits ambiguous exotic case-mapping ranges safely", () => {
    expect(getLiteralSearchHighlightRanges("机器人与KDE", ["机器人", "kde"])).toEqual([{ start: 0, end: 3 }, { start: 4, end: 7 }]);
    expect(getLiteralSearchHighlightRanges("İstanbul", ["i"])).toEqual([]);
  });

  it("builds short snippets without ellipses and preserves structural whitespace", () => {
    const snippet = buildPublishedSearchBodySnippet("alpha\n\nrobot   beta", ["robot"]);

    expect(snippet).toEqual({
      text: "alpha robot beta",
      prefixEllipsis: false,
      suffixEllipsis: false,
      highlights: [{ start: 6, end: 11 }],
    });
  });

  it("anchors a long snippet to the earliest body match with deterministic boundaries and ellipses", () => {
    const beginning = buildPublishedSearchBodySnippet(`EARLYMATCH ${"tail ".repeat(60)}`, ["earlymatch"]);
    const middle = buildPublishedSearchBodySnippet(`${"before ".repeat(30)}MIDDLEMATCH ${"after ".repeat(30)}`, ["middlematch"]);
    const ending = buildPublishedSearchBodySnippet(`${"before ".repeat(60)}ENDMATCH`, ["endmatch"]);

    expect(beginning?.prefixEllipsis).toBe(false);
    expect(beginning?.suffixEllipsis).toBe(true);
    expect(middle?.prefixEllipsis).toBe(true);
    expect(middle?.suffixEllipsis).toBe(true);
    expect(ending?.prefixEllipsis).toBe(true);
    expect(ending?.suffixEllipsis).toBe(false);
    expect(middle?.text).toContain("MIDDLEMATCH");
    expect(middle!.text.length).toBeLessThanOrEqual(publishedSearchSnippetLength + 48);
  });

  it("uses the earliest match rather than a later match window and returns ranges relative to the visible snippet", () => {
    const body = `EARLYMATCH ${"before ".repeat(50)}LATEMATCH ${"after ".repeat(50)}`;
    const snippet = buildPublishedSearchBodySnippet(body, ["earlymatch", "latematch"]);

    expect(snippet?.text).toContain("EARLYMATCH");
    expect(snippet?.text).not.toContain("LATEMATCH");
    expect(snippet?.highlights.map((range) => snippet.text.slice(range.start, range.end))).toEqual(["EARLYMATCH"]);
  });

  it("projects title, summary, matching tags in authored order, and only a body-contributed snippet", () => {
    const presentation = buildPublishedSearchMatchPresentation(document({
      title: "KDE Desktop",
      summary: "Classic KDE study",
      tags: ["Web", "KDE 3", "Qt"],
      bodyText: "The robot experiment is visible.",
    }), "kde web robot");

    expect(presentation.titleHighlights).toEqual([{ start: 0, end: 3 }]);
    expect(presentation.summaryHighlights).toEqual([{ start: 8, end: 11 }]);
    expect(presentation.matchingTags.map(({ tag }) => tag)).toEqual(["Web", "KDE 3"]);
    expect(presentation.bodySnippet?.text).toContain("robot");
    expect(buildPublishedSearchMatchPresentation(document({ bodyText: "Unrelated body" }), "kde").bodySnippet).toBeUndefined();
  });
});
