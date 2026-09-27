import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";

const publicationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publishedArticleHashPattern = /^#\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export type PublishedContentRoute =
  | { readonly kind: "article"; readonly slug: string };

export type PublishedArticleRouteResolution =
  | { readonly kind: "canonical"; readonly entry: PublishedContentCatalogEntry }
  | { readonly kind: "alias"; readonly entry: PublishedContentCatalogEntry; readonly matchedAlias: string };

/** Formats the only static-host publishing route this application currently owns. */
export function formatPublishedArticleHash(slug: string): string {
  if (!publicationSlugPattern.test(slug)) {
    throw new Error(`Invalid published article slug '${slug}'.`);
  }

  return `#/blog/${slug}`;
}

/** Ignores unrelated fragments rather than claiming browser-wide hash ownership. */
export function parsePublishedContentRoute(hash: string): PublishedContentRoute | undefined {
  const match = publishedArticleHashPattern.exec(hash);
  return match === null ? undefined : { kind: "article", slug: match[1]! };
}

/** Resolves only the live published catalog and never chooses arbitrarily from invalid synthetic duplicates. */
export function resolvePublishedContentRoute(
  catalog: readonly PublishedContentCatalogEntry[],
  route: PublishedContentRoute,
): PublishedArticleRouteResolution | undefined {
  const matches = catalog.flatMap((entry): readonly PublishedArticleRouteResolution[] => {
    const resolutions: PublishedArticleRouteResolution[] = [];
    if (entry.slug === route.slug) resolutions.push({ kind: "canonical", entry });
    if (entry.aliases.includes(route.slug)) resolutions.push({ kind: "alias", entry, matchedAlias: route.slug });
    return resolutions;
  });
  return matches.length === 1 ? matches[0] : undefined;
}
