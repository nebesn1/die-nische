import type {
  VfsAssetUrlFileContent,
  VfsAssetUrlFileNode,
  VfsFileNode,
  VfsNode,
  VfsTextFileContent,
  VfsTextFileNode,
} from "./types";

export const createVfsTextFileContent = (text: string): VfsTextFileContent => ({ kind: "text", text });

export const createVfsAssetUrlFileContent = (url: string): VfsAssetUrlFileContent => ({ kind: "asset-url", url });

export const isVfsTextFile = (node: VfsNode | VfsFileNode): node is VfsTextFileNode =>
  node.kind === "file" && node.content.kind === "text";

export const isVfsAssetUrlFile = (node: VfsNode | VfsFileNode): node is VfsAssetUrlFileNode =>
  node.kind === "file" && node.content.kind === "asset-url";

export const getVfsTextFileContent = (node: VfsNode | VfsFileNode): string | null =>
  isVfsTextFile(node) ? node.content.text : null;

export const getVfsFileAssetUrl = (node: VfsNode | VfsFileNode): string | null =>
  isVfsAssetUrlFile(node) && node.content.url.length > 0 ? node.content.url : null;
