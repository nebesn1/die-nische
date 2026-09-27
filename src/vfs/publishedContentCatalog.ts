import { isVfsTextFile } from "./fileContent";
import { getVfsPublicationTitle, isVfsFilePublished } from "./publication";
import { getVfsPathForNode } from "./queries";
import { isVfsNodeInsideTrash } from "./trashPaths";
import type { VfsNodeId, VfsState } from "./types";

export interface PublishedContentCatalogEntry {
  readonly nodeId: VfsNodeId;
  readonly canonicalPath: string;
  readonly canonicalName: string;
  readonly title: string;
  /** Optional because v4 publications deliberately remain linkless. */
  readonly slug?: string;
  /** Historical route tokens, always copied from publication metadata for safe read-only projection. */
  readonly aliases: readonly string[];
  readonly publishedAt: string;
  readonly summary?: string;
  readonly tags: readonly string[];
}

/** Deterministic Unicode code-point comparison for publishing projections. */
export const comparePublishedContentCodePoints = (left: string, right: string): number => {
  const leftCharacters = [...left];
  const rightCharacters = [...right];
  const length = Math.min(leftCharacters.length, rightCharacters.length);

  for (let index = 0; index < length; index += 1) {
    const leftPoint = leftCharacters[index]!.codePointAt(0)!;
    const rightPoint = rightCharacters[index]!.codePointAt(0)!;

    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }

  return leftCharacters.length - rightCharacters.length;
};

/** Builds a live, read-only projection for future publishing consumers. */
export function buildPublishedContentCatalog(state: VfsState): readonly PublishedContentCatalogEntry[] {
  const homePath = getVfsPathForNode(state, state.specialLocations.home);
  const home = state.nodesById[state.specialLocations.home];

  if (!homePath.ok || !home || home.kind !== "directory") return [];

  const catalog: PublishedContentCatalogEntry[] = [];
  const visited = new Set<VfsNodeId>();

  const visit = (nodeId: VfsNodeId): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = state.nodesById[nodeId];
    if (!node || isVfsNodeInsideTrash(state, node.id)) return;

    if (node.kind === "directory") {
      node.childIds.forEach(visit);
      return;
    }

    if (!isVfsTextFile(node) || !isVfsFilePublished(node) || node.publication.publishedAt === undefined) return;

    const path = getVfsPathForNode(state, node.id);
    if (!path.ok) return;

    catalog.push({
      nodeId: node.id,
      canonicalPath: path.value,
      canonicalName: node.name,
      title: getVfsPublicationTitle(node),
      ...(node.publication.slug === undefined ? {} : { slug: node.publication.slug }),
      aliases: node.publication.aliases === undefined ? [] : [...node.publication.aliases],
      publishedAt: node.publication.publishedAt,
      ...(node.publication.summary === undefined ? {} : { summary: node.publication.summary }),
      tags: node.publication.tags === undefined ? [] : [...node.publication.tags],
    });
  };

  home.childIds.forEach(visit);

  return catalog.sort((left, right) =>
    comparePublishedContentCodePoints(right.publishedAt, left.publishedAt)
    || comparePublishedContentCodePoints(left.canonicalPath, right.canonicalPath)
    || comparePublishedContentCodePoints(left.nodeId, right.nodeId));
}
