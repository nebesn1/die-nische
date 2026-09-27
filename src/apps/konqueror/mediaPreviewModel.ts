import { getVfsFileAssetUrl } from "../../vfs/fileContent";
import { getVfsNodeById } from "../../vfs/queries";
import type { VfsFileNode, VfsNode, VfsState } from "../../vfs/types";
import { sortKonquerorEntries, type KonquerorSortDescriptor } from "./directoryViewModel";

export type KonquerorMediaKind = "audio" | "video";

const MEDIA_MIME_TYPES: Readonly<Record<string, KonquerorMediaKind>> = Object.freeze({
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "video/ogg": "video",
});

export function getKonquerorMediaKind(node: VfsFileNode): KonquerorMediaKind | null {
  return node.content.kind === "asset-url" ? MEDIA_MIME_TYPES[node.mimeType.toLowerCase()] ?? null : null;
}

export function getKonquerorMediaSource(node: VfsFileNode): string | null {
  if (getKonquerorMediaKind(node) === null) return null;
  const assetUrl = getVfsFileAssetUrl(node);
  return assetUrl !== null && !assetUrl.startsWith("data:") ? assetUrl : null;
}

export function isKonquerorMediaFile(node: VfsFileNode): boolean {
  return getKonquerorMediaSource(node) !== null;
}

export function getKonquerorMediaSiblingNodeIds(
  state: VfsState,
  node: VfsFileNode,
  sort: KonquerorSortDescriptor,
): readonly string[] {
  if (node.parentId === null) return [];
  const parent = getVfsNodeById(state, node.parentId);
  if (!parent.ok || parent.value.kind !== "directory") return [];

  const mediaChildren = parent.value.childIds.reduce<VfsNode[]>((children, childId) => {
    const child = getVfsNodeById(state, childId);
    if (child.ok && child.value.kind === "file" && isKonquerorMediaFile(child.value)) {
      children.push(child.value);
    }
    return children;
  }, []);

  return sortKonquerorEntries(mediaChildren, sort).map((child) => child.id);
}

export function getKonquerorAdjacentMediaNodeId(
  state: VfsState,
  node: VfsFileNode,
  direction: "previous" | "next",
  sort: KonquerorSortDescriptor,
): string | null {
  const siblings = getKonquerorMediaSiblingNodeIds(state, node, sort);
  const currentIndex = siblings.indexOf(node.id);
  const adjacentIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
  return currentIndex < 0 ? null : siblings[adjacentIndex] ?? null;
}
