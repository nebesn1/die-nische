const publishedSearchHashPrefix = "#/blog/search/";

export interface PublishedSearchRoute {
  readonly kind: "search";
  readonly query: string;
}

/** Canonical route text keeps user-visible case, punctuation, token order, and duplicates intact. */
export function canonicalizePublishedSearchQuery(query: string): string | undefined {
  const tokens = query.trim().split(/\s+/u).filter((token) => token.length > 0);
  return tokens.length === 0 ? undefined : tokens.join(" ");
}

/** Formats one safely encoded, nonempty Search query segment without introducing an empty route. */
export function formatPublishedSearchHash(query: string): string | undefined {
  const canonicalQuery = canonicalizePublishedSearchQuery(query);
  if (canonicalQuery === undefined) return undefined;

  try {
    return `${publishedSearchHashPrefix}${encodeURIComponent(canonicalQuery)}`;
  } catch {
    return undefined;
  }
}

/** Parses exactly one raw segment and decodes it once; malformed or empty routes are ignored. */
export function parsePublishedSearchHash(hash: string): PublishedSearchRoute | undefined {
  if (!hash.startsWith(publishedSearchHashPrefix)) return undefined;

  const encodedQuery = hash.slice(publishedSearchHashPrefix.length);
  if (encodedQuery.length === 0 || encodedQuery.includes("/")) return undefined;

  try {
    const query = canonicalizePublishedSearchQuery(decodeURIComponent(encodedQuery));
    return query === undefined ? undefined : { kind: "search", query };
  } catch {
    return undefined;
  }
}
