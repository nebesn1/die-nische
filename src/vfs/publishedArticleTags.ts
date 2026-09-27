import { comparePublishedContentCodePoints, type PublishedContentCatalogEntry } from "./publishedContentCatalog";

export interface PublishedTagGroup {
  readonly tag: string;
  readonly entries: readonly PublishedContentCatalogEntry[];
}

/** Groups exact authored tags from the already ordered published catalog. */
export function buildPublishedArticleTagIndex(
  catalog: readonly PublishedContentCatalogEntry[],
): readonly PublishedTagGroup[] {
  const groupsByTag = new Map<string, { tag: string; entries: PublishedContentCatalogEntry[] }>();

  catalog.forEach((entry) => {
    entry.tags.forEach((tag) => {
      let group = groupsByTag.get(tag);

      if (group === undefined) {
        group = { tag, entries: [] };
        groupsByTag.set(tag, group);
      }

      group.entries.push(entry);
    });
  });

  return [...groupsByTag.values()].sort((left, right) => comparePublishedContentCodePoints(left.tag, right.tag));
}
