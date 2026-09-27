import { getVfsPathForNode, getVfsNodeById, listVfsDirectory } from "./queries";
import { createVfsError } from "./errors";
import { fail, ok, type VfsResult } from "./result";
import { isVfsNodeInsideTrash } from "./tree";
import type { VfsDirectoryNode, VfsNode, VfsNodeId, VfsState } from "./types";

export interface VfsDialogDirectory {
  readonly node: VfsDirectoryNode;
  readonly path: string;
  readonly children: readonly VfsNode[];
  readonly isInsideTrash: boolean;
}

/** The directory browser's displayed folder and optional single-click selection. */
export interface VfsDialogDirectorySelection {
  readonly currentDirectoryNodeId: VfsNodeId;
  readonly selectedDirectoryNodeId: VfsNodeId | null;
}

export function selectVfsDialogDirectory(
  currentDirectoryNodeId: VfsNodeId,
  selectedDirectoryNodeId: VfsNodeId,
): VfsDialogDirectorySelection {
  return { currentDirectoryNodeId, selectedDirectoryNodeId };
}

export function enterVfsDialogDirectory(currentDirectoryNodeId: VfsNodeId): VfsDialogDirectorySelection {
  return { currentDirectoryNodeId, selectedDirectoryNodeId: null };
}

/** Shared read-only directory navigation for application-owned VFS dialogs. */
export function getVfsDialogDirectory(state: VfsState, directoryNodeId: VfsNodeId): VfsDialogDirectory | null {
  const node = getVfsNodeById(state, directoryNodeId);
  if (!node.ok || node.value.kind !== "directory") return null;
  const path = getVfsPathForNode(state, node.value.id);
  const children = path.ok ? listVfsDirectory(state, path.value) : null;
  if (!path.ok || !children?.ok) return null;
  return { node: node.value, path: path.value, children: children.value, isInsideTrash: isVfsNodeInsideTrash(state, node.value.id) };
}

export function getVfsDialogParentDirectoryId(state: VfsState, directoryNodeId: VfsNodeId): VfsNodeId | null {
  const directory = getVfsDialogDirectory(state, directoryNodeId);
  if (!directory?.node.parentId) return null;
  const parent = getVfsNodeById(state, directory.node.parentId);
  return parent.ok && parent.value.kind === "directory" ? parent.value.id : null;
}

export function getVfsDialogNode(state: VfsState, directoryNodeId: VfsNodeId, nodeId: VfsNodeId): VfsNode | null {
  return getVfsDialogDirectory(state, directoryNodeId)?.children.find((node) => node.id === nodeId) ?? null;
}

export function getVfsDialogDirectoryNavigationTarget(state: VfsState, directoryNodeId: VfsNodeId, nodeId: VfsNodeId): VfsNodeId | null {
  const node = getVfsDialogNode(state, directoryNodeId, nodeId);
  return node?.kind === "directory" ? node.id : null;
}

/**
 * Resolves a chooser confirmation target without conflating the displayed
 * directory with a single-clicked child directory. The ids remain stable
 * through rename or move; an unavailable selected directory is an error and
 * never silently falls back to the displayed parent.
 */
export function resolveVfsDialogTargetDirectory(
  state: VfsState,
  currentDirectoryNodeId: VfsNodeId,
  selectedDirectoryNodeId: VfsNodeId | null,
): VfsResult<VfsNodeId> {
  const targetNodeId = selectedDirectoryNodeId ?? currentDirectoryNodeId;
  const target = getVfsNodeById(state, targetNodeId);
  if (!target.ok) return fail(target.error);

  if (target.value.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "Selected location is not a directory.", { nodeId: targetNodeId }));
  }

  return ok(target.value.id);
}
