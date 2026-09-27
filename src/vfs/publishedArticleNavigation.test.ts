import { describe, expect, it } from "vitest";
import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import { getPublishedArticleNeighbors } from "./publishedArticleNavigation";

const entry = (nodeId: string, title = nodeId): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath: `/home/user/Documents/${nodeId}.md`,
  canonicalName: `${nodeId}.md`,
  title,
  aliases: [],
  publishedAt: "2026-09-15T08:00:00.000Z",
  tags: [],
});

describe("published article navigation", () => {
  it("selects exact adjacent catalog entries without applying its own sort", () => {
    const catalog = [entry("node-c", "Zebra"), entry("node-a", "Duplicate"), entry("node-b", "Duplicate")];

    expect(getPublishedArticleNeighbors(catalog, "node-a")).toEqual({ previous: catalog[0], next: catalog[2] });
  });

  it("returns the expected first, last, single-entry, and missing boundaries without wrapping", () => {
    const catalog = [entry("first"), entry("last")];

    expect(getPublishedArticleNeighbors(catalog, "first")).toEqual({ next: catalog[1] });
    expect(getPublishedArticleNeighbors(catalog, "last")).toEqual({ previous: catalog[0] });
    expect(getPublishedArticleNeighbors([catalog[0]!], "first")).toEqual({});
    expect(getPublishedArticleNeighbors(catalog, "missing")).toEqual({});
  });
});
