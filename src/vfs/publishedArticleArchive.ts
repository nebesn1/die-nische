import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";

export interface PublishedArchiveMonthGroup {
  readonly year: number;
  readonly month: number;
  readonly entries: readonly PublishedContentCatalogEntry[];
}

export interface PublishedArchiveYearGroup {
  readonly year: number;
  readonly months: readonly PublishedArchiveMonthGroup[];
}

/** Projects the already ordered published catalog into UTC calendar groups without reordering entries. */
export function buildPublishedArticleArchive(
  catalog: readonly PublishedContentCatalogEntry[],
): readonly PublishedArchiveYearGroup[] {
  const years: PublishedArchiveYearGroup[] = [];
  const yearGroups = new Map<number, { year: number; months: PublishedArchiveMonthGroup[] }>();
  const monthGroups = new Map<string, { year: number; month: number; entries: PublishedContentCatalogEntry[] }>();

  catalog.forEach((entry) => {
    const publishedAt = new Date(entry.publishedAt);
    const year = publishedAt.getUTCFullYear();
    const month = publishedAt.getUTCMonth() + 1;
    const monthKey = `${year}-${month}`;
    let yearGroup = yearGroups.get(year);

    if (yearGroup === undefined) {
      yearGroup = { year, months: [] };
      yearGroups.set(year, yearGroup);
      years.push(yearGroup);
    }

    let monthGroup = monthGroups.get(monthKey);

    if (monthGroup === undefined) {
      monthGroup = { year, month, entries: [] };
      monthGroups.set(monthKey, monthGroup);
      yearGroup.months.push(monthGroup);
    }

    monthGroup.entries.push(entry);
  });

  return years;
}
