import { getVfsNodeById } from "../../../vfs/queries";
import type { VfsNodeId, VfsState } from "../../../vfs/types";

export interface VfsUsageSummary {
  readonly fileCount: number;
  readonly usedBytes: number;
}

export function summarizeVfsUsage(state: VfsState): VfsUsageSummary {
  const visited = new Set<VfsNodeId>();
  let fileCount = 0;
  let usedBytes = 0;

  const visit = (nodeId: VfsNodeId): void => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    const node = getVfsNodeById(state, nodeId);
    if (!node.ok) {
      return;
    }

    if (node.value.kind === "file") {
      fileCount += 1;
      usedBytes += node.value.size;
      return;
    }

    if (node.value.kind === "directory") {
      node.value.childIds.forEach(visit);
    }
  };

  visit(state.rootId);
  return { fileCount, usedBytes };
}
