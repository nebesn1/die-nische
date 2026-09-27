import type { VfsNode, VfsNodeId } from "../../vfs/types";
import { getSingleKonquerorSelectedNodeId, type KonquerorSelectedNodeIds } from "./selectionModel";
import { getKonquerorNodeTypeLabel } from "./formatters";
import { konquerorResourceZoomLevels, type KonquerorResourceZoomLevel } from "./resourceZoomLevels";

export type KonquerorResourceViewMode = "tree" | "icons";
export type KonquerorSortKey = "name" | "size" | "type" | "modified";
export type KonquerorSortDirection = "ascending" | "descending";

export { konquerorResourceZoomLevels, type KonquerorResourceZoomLevel } from "./resourceZoomLevels";

export interface KonquerorSortDescriptor {
  readonly key: KonquerorSortKey;
  readonly direction: KonquerorSortDirection;
}

export interface KonquerorDirectoryViewState {
  readonly viewMode: KonquerorResourceViewMode;
  readonly iconZoomLevel: KonquerorResourceZoomLevel;
  readonly treeZoomLevel: KonquerorResourceZoomLevel;
  readonly sort: KonquerorSortDescriptor;
  readonly expandedTreeNodeIds: readonly VfsNodeId[];
}

export type KonquerorDirectoryViewAction =
  | { readonly type: "set-view-mode"; readonly viewMode: KonquerorResourceViewMode }
  | { readonly type: "zoom-in" }
  | { readonly type: "zoom-out" }
  | { readonly type: "select-sort-key"; readonly key: KonquerorSortKey }
  | { readonly type: "set-sort-direction"; readonly direction: KonquerorSortDirection }
  | { readonly type: "toggle-sort-direction" }
  | { readonly type: "toggle-tree-expansion"; readonly nodeId: VfsNodeId }
  | { readonly type: "retain-tree-expansion"; readonly directoryNodeIds: readonly VfsNodeId[] };

export const defaultKonquerorDirectoryViewState: KonquerorDirectoryViewState = Object.freeze({
  viewMode: "tree",
  iconZoomLevel: "normal",
  treeZoomLevel: "normal",
  sort: Object.freeze({ key: "name", direction: "ascending" }),
  expandedTreeNodeIds: Object.freeze([]),
});

export interface KonquerorDirectoryViewSeed {
  readonly viewMode: KonquerorResourceViewMode;
  readonly iconZoomLevel: KonquerorResourceZoomLevel;
  readonly treeZoomLevel: KonquerorResourceZoomLevel;
}

export function createInitialKonquerorDirectoryViewState(
  seed: KonquerorDirectoryViewSeed = defaultKonquerorDirectoryViewState,
): KonquerorDirectoryViewState {
  return {
    ...defaultKonquerorDirectoryViewState,
    ...seed,
    sort: { ...defaultKonquerorDirectoryViewState.sort },
    expandedTreeNodeIds: [],
  };
}

export function getKonquerorResourceZoomLevel(state: KonquerorDirectoryViewState): KonquerorResourceZoomLevel {
  return state.viewMode === "icons" ? state.iconZoomLevel : state.treeZoomLevel;
}

export function canAdjustKonquerorResourceZoom(
  state: KonquerorDirectoryViewState,
  direction: "in" | "out",
): boolean {
  const index = konquerorResourceZoomLevels.indexOf(getKonquerorResourceZoomLevel(state));
  return direction === "in" ? index < konquerorResourceZoomLevels.length - 1 : index > 0;
}

export function getNextKonquerorResourceZoomLevel(
  current: KonquerorResourceZoomLevel,
  direction: "in" | "out",
): KonquerorResourceZoomLevel {
  const currentIndex = konquerorResourceZoomLevels.indexOf(current);
  const nextIndex = direction === "in"
    ? Math.min(currentIndex + 1, konquerorResourceZoomLevels.length - 1)
    : Math.max(currentIndex - 1, 0);

  return konquerorResourceZoomLevels[nextIndex];
}

const adjustZoom = (
  state: KonquerorDirectoryViewState,
  direction: "in" | "out",
): KonquerorDirectoryViewState => {
  const current = getKonquerorResourceZoomLevel(state);
  const next = getNextKonquerorResourceZoomLevel(current, direction);

  if (next === current) {
    return state;
  }

  return state.viewMode === "icons"
    ? { ...state, iconZoomLevel: next }
    : { ...state, treeZoomLevel: next };
};

const compareStrings = (left: string, right: string): number => {
  const foldedLeft = left.toLowerCase();
  const foldedRight = right.toLowerCase();

  if (foldedLeft !== foldedRight) {
    return foldedLeft < foldedRight ? -1 : 1;
  }

  if (left !== right) {
    return left < right ? -1 : 1;
  }

  return 0;
};

const compareByNameAndId = (left: VfsNode, right: VfsNode): number => {
  const nameComparison = compareStrings(left.name, right.name);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.id === right.id ? 0 : left.id < right.id ? -1 : 1;
};

const compareModified = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (!leftValid || !rightValid) {
    if (leftValid === rightValid) {
      return 0;
    }

    return leftValid ? -1 : 1;
  }

  return leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1;
};

const applyDirection = (comparison: number, direction: KonquerorSortDirection): number =>
  direction === "ascending" ? comparison : -comparison;

const compareWithinGroup = (left: VfsNode, right: VfsNode, sort: KonquerorSortDescriptor): number => {
  if (sort.key === "name") {
    return applyDirection(compareByNameAndId(left, right), sort.direction);
  }

  if (sort.key === "size") {
    const leftSize = left.kind === "file" ? left.size : left.kind === "link" ? 0 : null;
    const rightSize = right.kind === "file" ? right.size : right.kind === "link" ? 0 : null;
    if (leftSize === null || rightSize === null) {
      return compareByNameAndId(left, right);
    }

    const sizeComparison = leftSize === rightSize ? 0 : leftSize < rightSize ? -1 : 1;
    return sizeComparison === 0
      ? applyDirection(compareByNameAndId(left, right), sort.direction)
      : applyDirection(sizeComparison, sort.direction);
  }

  if (sort.key === "type") {
    const typeComparison = compareStrings(getKonquerorNodeTypeLabel(left), getKonquerorNodeTypeLabel(right));
    return typeComparison === 0
      ? applyDirection(compareByNameAndId(left, right), sort.direction)
      : applyDirection(typeComparison, sort.direction);
  }

  const modifiedComparison = compareModified(left.modifiedAt, right.modifiedAt);

  if (modifiedComparison === 0) {
    return applyDirection(compareByNameAndId(left, right), sort.direction);
  }

  // Invalid timestamps remain last in both directions.
  const leftValid = Number.isFinite(Date.parse(left.modifiedAt));
  const rightValid = Number.isFinite(Date.parse(right.modifiedAt));

  if (!leftValid || !rightValid) {
    return modifiedComparison;
  }

  return applyDirection(modifiedComparison, sort.direction);
};

export function sortKonquerorEntries(
  entries: readonly VfsNode[],
  sort: KonquerorSortDescriptor,
): readonly VfsNode[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }

    return compareWithinGroup(left, right, sort);
  });
}

export function konquerorDirectoryViewReducer(
  state: KonquerorDirectoryViewState,
  action: KonquerorDirectoryViewAction,
): KonquerorDirectoryViewState {
  switch (action.type) {
    case "set-view-mode":
      return state.viewMode === action.viewMode ? state : { ...state, viewMode: action.viewMode };
    case "zoom-in":
      return adjustZoom(state, "in");
    case "zoom-out":
      return adjustZoom(state, "out");
    case "select-sort-key":
      return state.sort.key === action.key
        ? {
            ...state,
            sort: {
              ...state.sort,
              direction: state.sort.direction === "ascending" ? "descending" : "ascending",
            },
          }
        : { ...state, sort: { key: action.key, direction: "ascending" } };
    case "set-sort-direction":
      return state.sort.direction === action.direction
        ? state
        : { ...state, sort: { ...state.sort, direction: action.direction } };
    case "toggle-sort-direction":
      return {
        ...state,
        sort: {
          ...state.sort,
          direction: state.sort.direction === "ascending" ? "descending" : "ascending",
        },
      };
    case "toggle-tree-expansion": {
      const expandedTreeNodeIds = state.expandedTreeNodeIds.includes(action.nodeId)
        ? state.expandedTreeNodeIds.filter((nodeId) => nodeId !== action.nodeId)
        : [...state.expandedTreeNodeIds, action.nodeId];
      return { ...state, expandedTreeNodeIds };
    }
    case "retain-tree-expansion": {
      const directories = new Set(action.directoryNodeIds);
      const expandedTreeNodeIds = state.expandedTreeNodeIds.filter((nodeId) => directories.has(nodeId));
      return expandedTreeNodeIds.length === state.expandedTreeNodeIds.length
        ? state
        : { ...state, expandedTreeNodeIds };
    }
    default:
      return state;
  }
}

export function getKonquerorAdjacentSelectionId(
  entries: readonly VfsNode[],
  selectedNodeIds: KonquerorSelectedNodeIds,
  direction: "previous" | "next",
): VfsNodeId | null {
  if (entries.length === 0) {
    return null;
  }

  const selectedNodeId = getSingleKonquerorSelectedNodeId(selectedNodeIds);
  const selectedIndex = selectedNodeId === null ? -1 : entries.findIndex((node) => node.id === selectedNodeId);

  if (selectedIndex === -1) {
    return direction === "next" ? entries[0]?.id ?? null : entries[entries.length - 1]?.id ?? null;
  }

  const nextIndex = direction === "next"
    ? Math.min(selectedIndex + 1, entries.length - 1)
    : Math.max(selectedIndex - 1, 0);

  return entries[nextIndex]?.id ?? null;
}
