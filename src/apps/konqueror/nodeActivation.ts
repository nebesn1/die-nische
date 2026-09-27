import type { VfsNode, VfsNodeId } from "../../vfs/types";

export type KonquerorNodeActivation =
  | { readonly type: "navigate-directory"; readonly nodeId: VfsNodeId }
  | { readonly type: "preview-text-file"; readonly nodeId: VfsNodeId };

export function getKonquerorNodeActivation(node: VfsNode): KonquerorNodeActivation {
  return node.kind === "directory"
    ? { type: "navigate-directory", nodeId: node.id }
    : { type: "preview-text-file", nodeId: node.id };
}
