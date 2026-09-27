import { describe, expect, it } from "vitest";
import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import { buildPublishedArticleTagIndex } from "./publishedArticleTags";

const entry = (nodeId: string, tags: readonly string[], title = nodeId): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath: `/home/user/Documents/${nodeId}.md`,
  canonicalName: `${nodeId}.md`,
  title,
  aliases: [],
  publishedAt: "2026-09-12T08:00:00.000Z",
  tags,
});

describe("published article tag index", () => {
  it("returns no groups for an empty or untagged catalog", () => {
    expect(buildPublishedArticleTagIndex([])).toEqual([]);
    expect(buildPublishedArticleTagIndex([entry("untagged", [])])).toEqual([]);
  });

  it("groups exact multi-tag membership while preserving the catalog order inside each group", () => {
    const a = entry("a", ["KDE 3", "Web"], "Z title");
    const b = entry("b", ["KDE 3", "Qt"], "A title");
    const c = entry("c", ["Web"]);
    const untagged = entry("untagged", []);
    const groups = buildPublishedArticleTagIndex([a, b, c, untagged]);

    expect(groups.map((group) => [group.tag, group.entries.map((article) => article.nodeId)])).toEqual([
      ["KDE 3", ["a", "b"]],
      ["Qt", ["b"]],
      ["Web", ["a", "c"]],
    ]);
  });

  it("keeps case-sensitive and Unicode tags independent while ordering tag groups by deterministic code point", () => {
    const catalog = [
      entry("unicode", ["机器人"]),
      entry("lower", ["qt"]),
      entry("web", ["Web"]),
      entry("upper", ["Qt"]),
      entry("kde", ["KDE 3"]),
    ];

    expect(buildPublishedArticleTagIndex(catalog).map((group) => group.tag)).toEqual(["KDE 3", "Qt", "Web", "qt", "机器人"]);
  });

  it("creates independent group arrays without a mutation path into source catalog membership or tag arrays", () => {
    const first = entry("first", ["Web"]);
    const second = entry("second", ["Web"]);
    const catalog = [first, second];
    const groups = buildPublishedArticleTagIndex(catalog);
    const entries = groups[0]?.entries as PublishedContentCatalogEntry[];

    entries.pop();
    expect(catalog).toEqual([first, second]);
    expect(first.tags).toEqual(["Web"]);
  });
});
