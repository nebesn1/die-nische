import type { PublishedContentCatalogEntry } from "./publishedContentCatalog";
import type { VfsNodeId } from "./types";

export interface PublishedArticleNeighbors {
  readonly previous?: PublishedContentCatalogEntry;
  readonly next?: PublishedContentCatalogEntry;
}

/** Selects direct neighbors from the already ordered live published-content catalog. */
export function getPublishedArticleNeighbors(
  catalog: readonly PublishedContentCatalogEntry[],
  currentNodeId: VfsNodeId,
): PublishedArticleNeighbors {
  const index = catalog.findIndex((entry) => entry.nodeId === currentNodeId);

  if (index < 0) return {};

  return {
    ...(catalog[index - 1] === undefined ? {} : { previous: catalog[index - 1] }),
    ...(catalog[index + 1] === undefined ? {} : { next: catalog[index + 1] }),
  };
}
