import { describe, expect, it } from "vitest";
import { canonicalizePublishedSearchQuery, formatPublishedSearchHash, parsePublishedSearchHash } from "./publishedSearchRoutes";

describe("published Search routes", () => {
  it("canonicalizes whitespace while preserving case, token order, duplicates, punctuation, and Unicode", () => {
    expect(canonicalizePublishedSearchQuery("   KDE   robot   ")).toBe("KDE robot");
    expect(canonicalizePublishedSearchQuery("robot KDE KDE")).toBe("robot KDE KDE");
    expect(canonicalizePublishedSearchQuery("Qt qt 机器人 C++")).toBe("Qt qt 机器人 C++");
    expect(canonicalizePublishedSearchQuery(" \t \n ")).toBeUndefined();
  });

  it("formats the canonical single encoded segment for spaces, punctuation, percent, slash, and Unicode", () => {
    expect(formatPublishedSearchHash("KDE 3")).toBe("#/blog/search/KDE%203");
    expect(formatPublishedSearchHash("C++")).toBe("#/blog/search/C%2B%2B");
    expect(formatPublishedSearchHash("A/B")).toBe("#/blog/search/A%2FB");
    expect(formatPublishedSearchHash("100%")).toBe("#/blog/search/100%25");
    expect(formatPublishedSearchHash("%2F")).toBe("#/blog/search/%252F");
    expect(formatPublishedSearchHash("机器人")).toBe("#/blog/search/%E6%9C%BA%E5%99%A8%E4%BA%BA");
    expect(formatPublishedSearchHash(".* [abc]")).toBe("#/blog/search/.*%20%5Babc%5D");
  });

  it("returns no route for empty or unencodable query text without changing the source text", () => {
    expect(formatPublishedSearchHash("  ")).toBeUndefined();
    expect(formatPublishedSearchHash("\uD800")).toBeUndefined();
  });

  it("parses exactly one raw segment with one decode and literal plus handling", () => {
    expect(parsePublishedSearchHash("#/blog/search/KDE%203")).toEqual({ kind: "search", query: "KDE 3" });
    expect(parsePublishedSearchHash("#/blog/search/A%2FB")).toEqual({ kind: "search", query: "A/B" });
    expect(parsePublishedSearchHash("#/blog/search/%252F")).toEqual({ kind: "search", query: "%2F" });
    expect(parsePublishedSearchHash("#/blog/search/C++")).toEqual({ kind: "search", query: "C++" });
  });

  it("rejects empty, extra-segment, malformed, and namespace-compatible non-Search hashes", () => {
    ["#/blog/search", "#/blog/search/", "#/blog/search/A/B", "#/blog/search/%", "#/blog/search/%2", "#/blog/search/%GG", "#/blog/tag/KDE%203", "#/blog/article-slug"].forEach((hash) => {
      expect(parsePublishedSearchHash(hash)).toBeUndefined();
    });
  });

  it("normalizes a valid noncanonical decoded query before formatting its canonical hash", () => {
    const route = parsePublishedSearchHash("#/blog/search/%20KDE%20%20robot%20");
    expect(route).toEqual({ kind: "search", query: "KDE robot" });
    expect(formatPublishedSearchHash(route!.query)).toBe("#/blog/search/KDE%20robot");
  });
});
