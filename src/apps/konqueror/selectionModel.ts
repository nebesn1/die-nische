import type { VfsNodeId } from "../../vfs/types";

export type KonquerorSelectedNodeIds = readonly VfsNodeId[];

export type KonquerorSelectionPointerIntent =
  | "replace"
  | "toggle"
  | "replace-range"
  | "add-range";

export function getKonquerorSelectionPointerIntent(
  button: number,
  ctrlKey: boolean,
  shiftKey: boolean,
): KonquerorSelectionPointerIntent | null {
  if (button !== 0) {
    return null;
  }

  if (ctrlKey && shiftKey) {
    return "add-range";
  }

  if (shiftKey) {
    return "replace-range";
  }

  return ctrlKey ? "toggle" : "replace";
}

export const emptyKonquerorSelection: KonquerorSelectedNodeIds = Object.freeze([]);

export function isKonquerorNodeSelected(
  selectedNodeIds: KonquerorSelectedNodeIds,
  nodeId: VfsNodeId,
): boolean {
  return selectedNodeIds.includes(nodeId);
}

export function getSingleKonquerorSelectedNodeId(
  selectedNodeIds: KonquerorSelectedNodeIds,
): VfsNodeId | null {
  return selectedNodeIds.length === 1 ? selectedNodeIds[0] ?? null : null;
}

export function replaceKonquerorSelection(nodeId: VfsNodeId): KonquerorSelectedNodeIds {
  return [nodeId];
}

export function normalizeKonquerorSelection(
  selectedNodeIds: readonly VfsNodeId[],
): KonquerorSelectedNodeIds {
  const seen = new Set<VfsNodeId>();

  return selectedNodeIds.filter((nodeId) => {
    if (seen.has(nodeId)) {
      return false;
    }

    seen.add(nodeId);
    return true;
  });
}

export function toggleKonquerorSelection(
  selectedNodeIds: KonquerorSelectedNodeIds,
  nodeId: VfsNodeId,
): KonquerorSelectedNodeIds {
  return isKonquerorNodeSelected(selectedNodeIds, nodeId)
    ? selectedNodeIds.filter((selectedNodeId) => selectedNodeId !== nodeId)
    : [...selectedNodeIds, nodeId];
}

export function getInclusiveKonquerorSelectionRange(
  visibleNodeIds: readonly VfsNodeId[],
  anchorNodeId: VfsNodeId,
  targetNodeId: VfsNodeId,
): KonquerorSelectedNodeIds | null {
  const anchorIndex = visibleNodeIds.indexOf(anchorNodeId);
  const targetIndex = visibleNodeIds.indexOf(targetNodeId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return null;
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);

  return normalizeKonquerorSelection(visibleNodeIds.slice(start, end + 1));
}

export function addKonquerorSelectionRange(
  selectedNodeIds: KonquerorSelectedNodeIds,
  rangeNodeIds: KonquerorSelectedNodeIds,
): KonquerorSelectedNodeIds {
  const normalizedSelectedNodeIds = normalizeKonquerorSelection(selectedNodeIds);
  const existing = new Set(normalizedSelectedNodeIds);

  return [...normalizedSelectedNodeIds, ...normalizeKonquerorSelection(rangeNodeIds).filter((nodeId) => !existing.has(nodeId))];
}

export function retainKonquerorSelection(
  selectedNodeIds: KonquerorSelectedNodeIds,
  visibleNodeIds: readonly VfsNodeId[],
): KonquerorSelectedNodeIds {
  const visible = new Set(visibleNodeIds);
  const retained = selectedNodeIds.filter((nodeId) => visible.has(nodeId));

  return retained.length === selectedNodeIds.length ? selectedNodeIds : retained;
}

/** Projects membership onto the current Resource presentation order. */
export function getKonquerorSelectedNodeIdsInVisibleOrder(
  selectedNodeIds: KonquerorSelectedNodeIds,
  visibleNodeIds: readonly VfsNodeId[],
): KonquerorSelectedNodeIds {
  const selected = new Set(normalizeKonquerorSelection(selectedNodeIds));

  return visibleNodeIds.filter((nodeId) => selected.has(nodeId));
}
