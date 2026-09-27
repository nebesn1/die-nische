import type { VfsNodeId } from "../../vfs/types";

export interface KWriteOpenTextFileIntent {
  readonly type: "open-text-file";
  readonly nodeId: VfsNodeId;
}

export function createKWriteOpenTextFileIntent(nodeId: VfsNodeId): KWriteOpenTextFileIntent {
  return {
    type: "open-text-file",
    nodeId,
  };
}

export function isKWriteOpenTextFileIntent(value: unknown): value is KWriteOpenTextFileIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown; readonly nodeId?: unknown };

  return candidate.type === "open-text-file" && typeof candidate.nodeId === "string" && candidate.nodeId.length > 0;
}
