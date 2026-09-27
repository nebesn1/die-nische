import type { VfsNode } from "./types";

/** Returns an optional presentation label without changing canonical VFS naming. */
export const getVfsNodeDisplayName = (node: VfsNode): string => node.displayName ?? node.name;
