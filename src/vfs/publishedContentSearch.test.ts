import { describe, expect, it } from "vitest";
import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import { searchPublishedContentCatalog, searchPublishedContentDocuments } from "./publishedContentSearch";

const entry = (
  nodeId: string,
  {
    title = nodeId,
    summary,
    tags = [],
    slug = `${nodeId}-slug`,
    aliases = [`${nodeId}-alias`],
    canonicalPath = `/home/user/Documents/${nodeId}.md`,
  }: Partial<PublishedContentCatalogEntry> = {},
): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath,
  canonicalName: `${nodeId}.md`,
  title,
  slug,
  aliases,
  publishedAt: "2026-09-13T08:00:00.000Z",
  ...(summary === undefined ? {} : { summary }),
  tags,
});

describe("published content metadata search", () => {
  it("returns no results for an empty catalog or a whitespace-only query", () => {
    const catalog = [entry("article", { title: "KDE Desktop" })];

    expect(searchPublishedContentCatalog([], "kde")).toEqual([]);
    expect(searchPublishedContentCatalog(catalog, "   \t ")).toEqual([]);
  });

  it("matches title, optional summary, and authored tags case-insensitively", () => {
    const catalog = [
      entry("title", { title: "KDE Desktop Notes" }),
      entry("summary", { summary: "Classic desktop reconstruction" }),
      entry("tag", { tags: ["Web", "Qt"] }),
    ];

    expect(searchPublishedContentCatalog(catalog, "desktop").map(({ nodeId }) => nodeId)).toEqual(["title", "summary"]);
    expect(searchPublishedContentCatalog(catalog, "KDE").map(({ nodeId }) => nodeId)).toEqual(["title"]);
    expect(searchPublishedContentCatalog(catalog, "reconstruction").map(({ nodeId }) => nodeId)).toEqual(["summary"]);
    expect(searchPublishedContentCatalog(catalog, "wEb").map(({ nodeId }) => nodeId)).toEqual(["tag"]);
  });

  it("uses whitespace-tokenized AND matching across separate metadata fields", () => {
    const catalog = [
      entry("cross-field", { title: "KDE Desktop", tags: ["Web"] }),
      entry("partial", { title: "KDE Desktop", tags: ["Retro"] }),
    ];

    expect(searchPublishedContentCatalog(catalog, "  kde   web ").map(({ nodeId }) => nodeId)).toEqual(["cross-field"]);
    expect(searchPublishedContentCatalog(catalog, "kde robot")).toEqual([]);
  });

  it("preserves catalog order without ranking, title sorting, or duplicate results", () => {
    const zebra = entry("zebra", { title: "Web Zebra", tags: ["Web"] });
    const alpha = entry("alpha", { title: "Web Alpha", tags: ["Web"] });
    const catalog = [zebra, alpha];

    expect(searchPublishedContentCatalog(catalog, "web web")).toEqual([zebra, alpha]);
    expect(catalog).toEqual([zebra, alpha]);
  });

  it("uses ordinary Unicode lowercasing and substring matching without changing Tag identity", () => {
    const catalog = [
      entry("upper", { tags: ["Qt"] }),
      entry("lower", { tags: ["qt"] }),
      entry("robot", { tags: ["机器人"] }),
    ];

    expect(searchPublishedContentCatalog(catalog, "qt").map(({ nodeId }) => nodeId)).toEqual(["upper", "lower"]);
    expect(searchPublishedContentCatalog(catalog, "机器人").map(({ nodeId }) => nodeId)).toEqual(["robot"]);
  });

  it("does not search paths, canonical names, slugs, aliases, or IDs", () => {
    const catalog = [entry("body-only-id", {
      title: "Visible metadata",
      canonicalPath: "/home/user/Documents/robot-path.md",
      slug: "secret-route-name",
      aliases: ["historical-secret"],
    })];

    expect(searchPublishedContentCatalog(catalog, "robot-path")).toEqual([]);
    expect(searchPublishedContentCatalog(catalog, "secret-route-name")).toEqual([]);
    expect(searchPublishedContentCatalog(catalog, "historical-secret")).toEqual([]);
    expect(searchPublishedContentCatalog(catalog, "body-only-id")).toEqual([]);
  });

  it("searches visible body text with metadata/body AND matching without ranking or source-only metadata", () => {
    const zebra = entry("zebra", { title: "KDE Desktop", tags: ["Qt"] });
    const alpha = entry("alpha", { title: "Other" });
    const documents = [
      { entry: zebra, bodyText: "Robot experiment 机械臂 robot robot" },
      { entry: alpha, bodyText: "Robot experiment" },
    ];

    expect(searchPublishedContentDocuments(documents, "robot").map(({ entry }) => entry.nodeId)).toEqual(["zebra", "alpha"]);
    expect(searchPublishedContentDocuments(documents, "kde robot").map(({ entry }) => entry.nodeId)).toEqual(["zebra"]);
    expect(searchPublishedContentDocuments(documents, "qt 机械臂").map(({ entry }) => entry.nodeId)).toEqual(["zebra"]);
    expect(searchPublishedContentDocuments(documents, "robot nowhere")).toEqual([]);
  });
});
