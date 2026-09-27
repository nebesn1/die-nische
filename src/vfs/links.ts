import { createVfsError, type VfsError } from "./errors";
import { getVfsPathForNode } from "./queries";
import { fail, ok, type VfsResult } from "./result";
import { isVfsNodeInsideTrash } from "./tree";
import type { VfsLinkNode, VfsNode, VfsNodeId, VfsState } from "./types";

export type VfsLinkTargetStatus =
  | { readonly type: "resolved"; readonly node: VfsNode; readonly path: string }
  | { readonly type: "missing"; readonly linkNodeId: VfsNodeId; readonly targetNodeId: VfsNodeId }
  | { readonly type: "unavailable"; readonly linkNodeId: VfsNodeId; readonly targetNodeId: VfsNodeId }
  | { readonly type: "cycle"; readonly linkNodeId: VfsNodeId; readonly targetNodeId: VfsNodeId };

const toResolutionError = (status: Exclude<VfsLinkTargetStatus, { readonly type: "resolved" }>): VfsError => {
  switch (status.type) {
    case "missing":
      return createVfsError("NOT_FOUND", "The link target no longer exists.", { nodeId: status.targetNodeId });
    case "unavailable":
      return createVfsError("INVALID_DESTINATION", "The link target is unavailable.", { nodeId: status.targetNodeId });
    case "cycle":
      return createVfsError("INVALID_PATH", "The link target cannot be resolved.", { nodeId: status.linkNodeId });
  }
};

/** Resolves stable identity links without turning them into path-traversal nodes. */
export function getVfsLinkTargetStatus(state: VfsState, nodeId: VfsNodeId): VfsLinkTargetStatus {
  const start = state.nodesById[nodeId];
  if (!start) {
    return { type: "missing", linkNodeId: nodeId, targetNodeId: nodeId };
  }

  const visited = new Set<VfsNodeId>();
  let current: VfsNode = start;
  let linkNodeId = start.id;

  while (current.kind === "link") {
    if (visited.has(current.id)) {
      return { type: "cycle", linkNodeId, targetNodeId: current.targetNodeId };
    }
    visited.add(current.id);
    linkNodeId = current.id;
    const target = state.nodesById[current.targetNodeId];
    if (!target) {
      return { type: "missing", linkNodeId, targetNodeId: current.targetNodeId };
    }
    if (isVfsNodeInsideTrash(state, target.id)) {
      return { type: "unavailable", linkNodeId, targetNodeId: target.id };
    }
    current = target;
  }

  const path = getVfsPathForNode(state, current.id);
  return path.ok
    ? { type: "resolved", node: current, path: path.value }
    : { type: "missing", linkNodeId, targetNodeId: current.id };
}

export function resolveVfsLinkTarget(state: VfsState, nodeId: VfsNodeId): VfsResult<{ readonly node: VfsNode; readonly path: string }> {
  const status = getVfsLinkTargetStatus(state, nodeId);
  return status.type === "resolved" ? ok({ node: status.node, path: status.path }) : fail(toResolutionError(status));
}

export const isVfsLinkNode = (node: VfsNode): node is VfsLinkNode => node.kind === "link";
