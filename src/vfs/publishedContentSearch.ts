import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";

export interface PublishedContentSearchDocument {
  readonly entry: PublishedContentCatalogEntry;
  readonly bodyText: string;
}

/** Shared query normalization for search eligibility and its read-only result presentation. */
export const getPublishedContentSearchTokens = (query: string): readonly string[] => {
  const trimmed = query.trim();

  return trimmed.length === 0 ? [] : trimmed.split(/\s+/u).map((token) => token.toLowerCase());
};

const getSearchableFields = ({ entry, bodyText }: PublishedContentSearchDocument): readonly string[] => [
  entry.title,
  ...(entry.summary === undefined ? [] : [entry.summary]),
  ...entry.tags,
  bodyText,
];

/** Filters already ordered search documents with case-insensitive AND-token matching and never ranks results. */
export function searchPublishedContentDocuments(
  documents: readonly PublishedContentSearchDocument[],
  query: string,
): readonly PublishedContentSearchDocument[] {
  const tokens = getPublishedContentSearchTokens(query);

  if (tokens.length === 0) return [];

  return documents.filter((document) => {
    const fields = getSearchableFields(document).map((field) => field.toLowerCase());

    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}

/** Compatibility projection for metadata-only callers; full Blog Search supplies live body text documents. */
export function searchPublishedContentCatalog(
  catalog: readonly PublishedContentCatalogEntry[],
  query: string,
): readonly PublishedContentCatalogEntry[] {
  return searchPublishedContentDocuments(catalog.map((entry) => ({ entry, bodyText: "" })), query).map(({ entry }) => entry);
}
