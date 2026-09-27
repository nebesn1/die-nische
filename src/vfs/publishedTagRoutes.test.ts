import { describe, expect, it } from "vitest";
import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import { buildPublishedArticleTagIndex } from "./publishedArticleTags";
import { formatPublishedTagHash, parsePublishedTagHash, resolvePublishedTagRoute } from "./publishedTagRoutes";

const entry = (nodeId: string, tags: readonly string[]): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath: `/home/user/Documents/${nodeId}.md`,
  canonicalName: `${nodeId}.md`,
  title: nodeId,
  aliases: [],
  publishedAt: "2026-09-15T08:00:00.000Z",
  tags,
});

describe("published tag hash routes", () => {
  it("formats and parses exact spaces, plus, slash, percent, and Unicode tag identities", () => {
    const cases = [
      ["Qt", "#/blog/tag/Qt"],
      ["KDE 3", "#/blog/tag/KDE%203"],
      ["C++", "#/blog/tag/C%2B%2B"],
      ["A/B", "#/blog/tag/A%2FB"],
      ["100%", "#/blog/tag/100%25"],
      ["机器人", "#/blog/tag/%E6%9C%BA%E5%99%A8%E4%BA%BA"],
    ] as const;

    cases.forEach(([tag, hash]) => {
      expect(formatPublishedTagHash(tag)).toBe(hash);
      expect(parsePublishedTagHash(hash)).toEqual({ kind: "tag", tag });
    });
  });

  it("decodes exactly once and leaves plus as a literal plus", () => {
    expect(formatPublishedTagHash("%2F")).toBe("#/blog/tag/%252F");
    expect(parsePublishedTagHash("#/blog/tag/%252F")).toEqual({ kind: "tag", tag: "%2F" });
    expect(parsePublishedTagHash("#/blog/tag/C++")).toEqual({ kind: "tag", tag: "C++" });
  });

  it("safely rejects malformed, empty, multi-segment, and unrelated hashes", () => {
    ["#/blog/tag/", "#/blog/tag/A/B", "#/blog/tag/%", "#/blog/tag/%2", "#/blog/tag/%E0%A4%A", "#/blog/tags/Qt", "#/tag/Qt", "#other"].forEach((hash) => {
      expect(parsePublishedTagHash(hash)).toBeUndefined();
    });
  });

  it("resolves only exact live current-index groups without case folding", () => {
    const tagIndex = buildPublishedArticleTagIndex([entry("upper", ["Qt"]), entry("lower", ["qt"]), entry("unicode", ["机器人"])]);
    const qt = parsePublishedTagHash("#/blog/tag/Qt");
    const lower = parsePublishedTagHash("#/blog/tag/qt");
    const missing = parsePublishedTagHash("#/blog/tag/QT");
    if (!qt || !lower || !missing) throw new Error("Route fixtures invalid.");

    expect(resolvePublishedTagRoute(tagIndex, qt)?.tag).toBe("Qt");
    expect(resolvePublishedTagRoute(tagIndex, lower)?.tag).toBe("qt");
    expect(resolvePublishedTagRoute(tagIndex, missing)).toBeUndefined();
  });
});
