import { describe, expect, it } from "vitest";
import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import { buildPublishedArticleArchive } from "./publishedArticleArchive";

const entry = (
  nodeId: string,
  publishedAt: string,
  title = nodeId,
): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath: `/home/user/Documents/${nodeId}.md`,
  canonicalName: `${nodeId}.md`,
  title,
  aliases: [],
  publishedAt,
  tags: [],
});

describe("published article archive", () => {
  it("returns no groups for an empty catalog and one UTC group for a single article", () => {
    expect(buildPublishedArticleArchive([])).toEqual([]);

    const article = entry("single", "2026-09-12T08:00:00.000Z");
    expect(buildPublishedArticleArchive([article])).toEqual([
      { year: 2026, months: [{ year: 2026, month: 9, entries: [article] }] },
    ]);
  });

  it("groups by UTC year and month while preserving exact input order without a local sort", () => {
    const septemberZ = entry("z", "2026-09-20T12:00:00.000Z", "Z title");
    const septemberA = entry("a", "2026-09-05T12:00:00.000Z", "A title");
    const august = entry("august", "2026-08-15T12:00:00.000Z");
    const previousYear = entry("previous-year", "2025-12-15T12:00:00.000Z");

    expect(buildPublishedArticleArchive([septemberZ, septemberA, august, previousYear])).toEqual([
      {
        year: 2026,
        months: [
          { year: 2026, month: 9, entries: [septemberZ, septemberA] },
          { year: 2026, month: 8, entries: [august] },
        ],
      },
      { year: 2025, months: [{ year: 2025, month: 12, entries: [previousYear] }] },
    ]);
  });

  it("uses UTC calendar boundaries independent of the browser timezone", () => {
    const september = entry("september", "2026-09-01T00:30:00.000Z");
    const august = entry("august", "2026-08-31T23:30:00.000Z");
    const january = entry("january", "2027-01-01T00:30:00.000Z");
    const december = entry("december", "2026-12-31T23:30:00.000Z");

    expect(buildPublishedArticleArchive([january, december, september, august])).toEqual([
      { year: 2027, months: [{ year: 2027, month: 1, entries: [january] }] },
      {
        year: 2026,
        months: [
          { year: 2026, month: 12, entries: [december] },
          { year: 2026, month: 9, entries: [september] },
          { year: 2026, month: 8, entries: [august] },
        ],
      },
    ]);
  });

  it("keeps duplicate titles as distinct catalog entries by node id", () => {
    const first = entry("first", "2026-09-12T08:00:00.000Z", "Project");
    const second = entry("second", "2026-09-11T08:00:00.000Z", "Project");

    expect(buildPublishedArticleArchive([first, second])[0]?.months[0]?.entries.map((article) => article.nodeId)).toEqual(["first", "second"]);
  });
});
