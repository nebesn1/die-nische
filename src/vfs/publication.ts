import { getVfsNodeDisplayName } from "./presentation";
import type { VfsFileNode, VfsNode } from "./types";

/** Publication state is explicit: unmanaged files are neither drafts nor published. */
export const isVfsFilePublished = (node: VfsNode): node is VfsFileNode & { readonly publication: { readonly status: "published" } } =>
  node.kind === "file" && node.publication?.status === "published";

export const isVfsFileDraft = (node: VfsNode): node is VfsFileNode & { readonly publication: { readonly status: "draft" } } =>
  node.kind === "file" && node.publication?.status === "draft";

/** Future publishing surfaces use the existing presentation label without inventing a second title field. */
export const getVfsPublicationTitle = (node: VfsFileNode): string => getVfsNodeDisplayName(node);
