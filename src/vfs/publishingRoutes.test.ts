import { describe, expect, it } from "vitest";
import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import {
  formatPublishedArticleHash,
  parsePublishedContentRoute,
  resolvePublishedContentRoute,
} from "./publishingRoutes";

const entry = (nodeId: string, slug?: string, aliases: readonly string[] = []): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath: `/home/user/Documents/${nodeId}.md`,
  canonicalName: `${nodeId}.md`,
  title: nodeId,
  ...(slug === undefined ? {} : { slug }),
  aliases,
  publishedAt: "2026-09-15T08:00:00.000Z",
  tags: [],
});

describe("published content hash routes", () => {
  it("formats only a canonical article hash", () => {
    expect(formatPublishedArticleHash("kde3-routing")).toBe("#/blog/kde3-routing");
    expect(() => formatPublishedArticleHash("KDE3")).toThrow("Invalid published article slug");
  });

  it("parses only strict canonical article routes and ignores unrelated hashes", () => {
    expect(parsePublishedContentRoute("#/blog/kde3-routing")).toEqual({ kind: "article", slug: "kde3-routing" });
    ["", "#foo", "#/blog/", "#/blog/a/", "#/blog/a/b", "#/blog/A", "#/blog/a%2Fb", "#/blog/../a"].forEach((hash) => {
      expect(parsePublishedContentRoute(hash)).toBeUndefined();
    });
  });

  it("distinguishes canonical and historical alias matches without resolving impossible duplicates", () => {
    const catalog = [entry("vfs-a", "same-title", ["old-title"]), entry("vfs-b", "other")];
    const route = parsePublishedContentRoute("#/blog/same-title");
    if (!route) throw new Error("Route fixture invalid.");
    expect(resolvePublishedContentRoute(catalog, route)).toEqual({ kind: "canonical", entry: catalog[0] });
    expect(resolvePublishedContentRoute(catalog, { kind: "article", slug: "old-title" })).toEqual({ kind: "alias", entry: catalog[0], matchedAlias: "old-title" });
    expect(resolvePublishedContentRoute([...catalog, entry("vfs-c", "same-title")], route)).toBeUndefined();
    expect(resolvePublishedContentRoute([...catalog, entry("vfs-c", "different", ["old-title"])], { kind: "article", slug: "old-title" })).toBeUndefined();
    expect(resolvePublishedContentRoute(catalog, { kind: "article", slug: "missing" })).toBeUndefined();
  });
});
