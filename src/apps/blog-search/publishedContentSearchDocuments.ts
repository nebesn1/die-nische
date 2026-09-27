import { getSafeVfsDocumentText } from "../konqueror/safeVfsDocumentText";
import { isVfsTextFile } from "../../vfs/fileContent";
import type { PublishedContentCatalogEntry } from "../../vfs/publishedContentCatalog";
import type { VfsState } from "../../vfs/types";

export interface PublishedContentSearchDocument {
  readonly entry: PublishedContentCatalogEntry;
  readonly bodyText: string;
}

/** Resolves only catalog members by stable ID, preserving catalog order and avoiding VFS discovery traversal. */
export function buildPublishedContentSearchDocuments(
  catalog: readonly PublishedContentCatalogEntry[],
  state: VfsState,
): readonly PublishedContentSearchDocument[] {
  return catalog.map((entry) => {
    const node = state.nodesById[entry.nodeId];
    return {
      entry,
      bodyText: node !== undefined && isVfsTextFile(node) ? getSafeVfsDocumentText(node) : "",
    };
  });
}
