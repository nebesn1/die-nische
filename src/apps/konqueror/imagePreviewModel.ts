import { getVfsNodeById } from "../../vfs/queries";
import { getVfsFileAssetUrl, getVfsTextFileContent } from "../../vfs/fileContent";
import type { VfsFileNode, VfsState } from "../../vfs/types";

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

const hasSupportedImageMimeType = (node: VfsFileNode): boolean => IMAGE_MIME_TYPES.has(node.mimeType.toLowerCase());

export function isKonquerorImageFile(node: VfsFileNode): boolean {
  return hasSupportedImageMimeType(node) && getKonquerorImageSource(node) !== null;
}

/** Image sources are Vite/static asset URLs, with legacy matching data URLs retained for existing seeds. */
export function getKonquerorImageSource(node: VfsFileNode): string | null {
  const mimeType = node.mimeType.toLowerCase();
  if (!hasSupportedImageMimeType(node)) return null;

  const assetUrl = getVfsFileAssetUrl(node);
  if (assetUrl !== null) return assetUrl;

  const legacyDataUrl = getVfsTextFileContent(node);
  return legacyDataUrl?.startsWith(`data:${mimeType}`) ? legacyDataUrl : null;
}

export function getKonquerorImageSiblingNodeIds(
  state: VfsState,
  node: VfsFileNode,
): readonly string[] {
  if (node.parentId === null) return [];
  const parent = getVfsNodeById(state, node.parentId);
  if (!parent.ok || parent.value.kind !== "directory") return [];

  return parent.value.childIds.filter((childId) => {
    const child = getVfsNodeById(state, childId);
    return child.ok && child.value.kind === "file" && isKonquerorImageFile(child.value);
  });
}

export function getKonquerorAdjacentImageNodeId(
  state: VfsState,
  node: VfsFileNode,
  direction: "previous" | "next",
): string | null {
  const siblings = getKonquerorImageSiblingNodeIds(state, node);
  const currentIndex = siblings.indexOf(node.id);
  const adjacentIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
  return currentIndex < 0 ? null : siblings[adjacentIndex] ?? null;
}
