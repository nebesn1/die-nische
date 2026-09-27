import type { PublishedTagGroup } from "./publishedArticleTags";

const publishedTagHashPrefix = "#/blog/tag/";

export interface PublishedTagRoute {
  readonly kind: "tag";
  readonly tag: string;
}

/** Formats a tag as its one canonical static-host-safe path segment. */
export function formatPublishedTagHash(tag: string): string {
  return `${publishedTagHashPrefix}${encodeURIComponent(tag)}`;
}

/** Parses one raw encoded segment and decodes it exactly once. */
export function parsePublishedTagHash(hash: string): PublishedTagRoute | undefined {
  if (!hash.startsWith(publishedTagHashPrefix)) return undefined;

  const encodedTag = hash.slice(publishedTagHashPrefix.length);
  if (encodedTag.length === 0 || encodedTag.includes("/")) return undefined;

  try {
    return { kind: "tag", tag: decodeURIComponent(encodedTag) };
  } catch {
    return undefined;
  }
}

/** Resolves only exact current tag groups; tags have no aliases or normalized route keys. */
export function resolvePublishedTagRoute(
  tagIndex: readonly PublishedTagGroup[],
  route: PublishedTagRoute,
): PublishedTagGroup | undefined {
  return tagIndex.find((group) => group.tag === route.tag);
}
