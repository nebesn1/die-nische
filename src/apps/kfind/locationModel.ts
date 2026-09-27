import { createVfsError } from "../../vfs/errors";
import { normalizeVfsPath } from "../../vfs/path";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";
import { fail, ok, type VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";

export interface KFindResolvedLocation {
  readonly nodeId: VfsNodeId;
  readonly presentation: string;
}

const fileScheme = "file://";
const absoluteFileScheme = "file:///";

export function formatKFindLocation(path: string): string {
  return `${fileScheme}${path}`;
}

export function getKFindLocationPresentation(state: VfsState, nodeId: VfsNodeId): VfsResult<string> {
  const path = getVfsPathForNode(state, nodeId);
  return path.ok ? ok(formatKFindLocation(path.value)) : path;
}

export function resolveKFindLocationInput(state: VfsState, input: string): VfsResult<KFindResolvedLocation> {
  const draft = input.trim();
  if (draft.length === 0) {
    return fail(createVfsError("INVALID_PATH", "Location is unavailable.", { path: input }));
  }

  if (draft.startsWith(fileScheme) && !draft.startsWith(absoluteFileScheme)) {
    return fail(createVfsError("INVALID_PATH", "Location must use an absolute VFS path.", { path: input }));
  }

  const vfsPath = draft.startsWith(absoluteFileScheme) ? draft.slice(fileScheme.length) : draft;
  const normalized = normalizeVfsPath(vfsPath);
  if (!normalized.ok) return normalized;

  const node = resolveVfsPath(state, normalized.value);
  if (!node.ok) return node;
  if (node.value.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "Location is not a folder.", { path: normalized.value, nodeId: node.value.id }));
  }

  return ok({ nodeId: node.value.id, presentation: formatKFindLocation(normalized.value) });
}
