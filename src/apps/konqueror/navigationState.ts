import type { VfsNodeId } from "../../vfs/types";
import type { KonquerorLocationTarget, KonquerorNavigationAction, KonquerorNavigationState } from "./navigationTypes";
import {
  addKonquerorSelectionRange,
  emptyKonquerorSelection,
  getInclusiveKonquerorSelectionRange,
  getSingleKonquerorSelectedNodeId,
  normalizeKonquerorSelection,
  replaceKonquerorSelection,
  retainKonquerorSelection,
  toggleKonquerorSelection,
} from "./selectionModel";

export function createInitialKonquerorNavigationState(
  initialTarget: VfsNodeId | KonquerorLocationTarget,
  homePath: string,
): KonquerorNavigationState {
  const target = typeof initialTarget === "string" ? { type: "directory" as const, nodeId: initialTarget } : initialTarget;

  return {
    historyTargets: [target],
    historyIndex: 0,
    selectedNodeIds: emptyKonquerorSelection,
    rangeAnchorNodeId: null,
    locationDraft: getKonquerorLocationDraft(target, homePath),
    navigationError: null,
  };
}

const clearKonquerorSelectionContext = (state: KonquerorNavigationState): KonquerorNavigationState =>
  state.selectedNodeIds.length === 0 && state.rangeAnchorNodeId === null
    ? state
    : {
        ...state,
        selectedNodeIds: emptyKonquerorSelection,
        rangeAnchorNodeId: null,
      };

const replaceKonquerorSelectionContext = (
  state: KonquerorNavigationState,
  nodeId: VfsNodeId,
): KonquerorNavigationState => ({
  ...state,
  selectedNodeIds: replaceKonquerorSelection(nodeId),
  rangeAnchorNodeId: nodeId,
});

export function getKonquerorLocationDraft(target: KonquerorLocationTarget | null, canonicalPath: string): string {
  return target?.type === "about-blank" || (target?.type === "about-konqueror" && target.addressPresentation === "blank")
    ? ""
    : canonicalPath;
}

export function getCurrentKonquerorNodeId(state: KonquerorNavigationState): VfsNodeId | null {
  const target = getKonquerorHistoryTargets(state)[state.historyIndex];
  return target?.type === "directory" || target?.type === "file" ? target.nodeId : null;
}

export function getCurrentKonquerorLocationTarget(state: KonquerorNavigationState): KonquerorLocationTarget | null {
  return getKonquerorHistoryTargets(state)[state.historyIndex] ?? null;
}

export function getKonquerorHistoryTargets(state: KonquerorNavigationState): readonly KonquerorLocationTarget[] {
  return state.historyTargets;
}

export function canNavigateBack(state: KonquerorNavigationState): boolean {
  return state.historyIndex > 0;
}

export function canNavigateForward(state: KonquerorNavigationState): boolean {
  return state.historyIndex < getKonquerorHistoryTargets(state).length - 1;
}

const sameTarget = (left: KonquerorLocationTarget | null, right: KonquerorLocationTarget): boolean => {
  if (left?.type !== right.type) {
    return false;
  }

  if (left.type === "sysinfo" || left.type === "about-konqueror" || left.type === "about-blank") {
    return true;
  }

  if (left.type === "external-web" && right.type === "external-web") {
    return left.canonicalUrl === right.canonicalUrl;
  }

  return (
    (left.type === "directory" || left.type === "file") &&
    (right.type === "directory" || right.type === "file") &&
    left.nodeId === right.nodeId
  );
};

export function konquerorNavigationReducer(
  state: KonquerorNavigationState,
  action: KonquerorNavigationAction,
): KonquerorNavigationState {
  switch (action.type) {
    case "set-location-draft":
      return {
        ...state,
        locationDraft: action.locationDraft,
        navigationError: null,
      };

    case "navigate-success": {
      const currentTarget = getCurrentKonquerorLocationTarget(state);
      const target = action.target;

      if (sameTarget(currentTarget, target)) {
        const historyTargets =
          currentTarget?.type === "file" && target.type === "file" && currentTarget.previewerId !== target.previewerId
            ? state.historyTargets.map((historyTarget, index) => (index === state.historyIndex ? target : historyTarget))
            : currentTarget?.type === "about-konqueror" &&
              target.type === "about-konqueror" &&
              currentTarget.addressPresentation !== target.addressPresentation
            ? state.historyTargets.map((historyTarget, index) => (index === state.historyIndex ? target : historyTarget))
            : state.historyTargets;
        return {
          ...state,
          historyTargets,
          selectedNodeIds: emptyKonquerorSelection,
          rangeAnchorNodeId: null,
          locationDraft: getKonquerorLocationDraft(target, action.path),
          navigationError: null,
        };
      }

      const historyTargets = [...getKonquerorHistoryTargets(state).slice(0, state.historyIndex + 1), target];

      return {
        historyTargets,
        historyIndex: historyTargets.length - 1,
        selectedNodeIds: emptyKonquerorSelection,
        rangeAnchorNodeId: null,
        locationDraft: getKonquerorLocationDraft(target, action.path),
        navigationError: null,
      };
    }

    case "navigate-failure":
      return {
        ...state,
        locationDraft: action.locationDraft,
        navigationError: action.error,
      };

    case "go-back":
      if (!canNavigateBack(state)) {
        return state;
      }

      return {
        ...state,
        historyIndex: state.historyIndex - 1,
        selectedNodeIds: emptyKonquerorSelection,
        rangeAnchorNodeId: null,
        locationDraft: getKonquerorLocationDraft(state.historyTargets[state.historyIndex - 1] ?? null, action.path),
        navigationError: null,
      };

    case "go-forward":
      if (!canNavigateForward(state)) {
        return state;
      }

      return {
        ...state,
        historyIndex: state.historyIndex + 1,
        selectedNodeIds: emptyKonquerorSelection,
        rangeAnchorNodeId: null,
        locationDraft: getKonquerorLocationDraft(state.historyTargets[state.historyIndex + 1] ?? null, action.path),
        navigationError: null,
      };

    case "go-history":
      if (
        action.historyIndex < 0 ||
        action.historyIndex >= getKonquerorHistoryTargets(state).length ||
        action.historyIndex === state.historyIndex
      ) {
        return state;
      }

      return {
        ...state,
        historyIndex: action.historyIndex,
        selectedNodeIds: emptyKonquerorSelection,
        rangeAnchorNodeId: null,
        locationDraft: getKonquerorLocationDraft(state.historyTargets[action.historyIndex] ?? null, action.path),
        navigationError: null,
      };

    case "replace-selection":
      return replaceKonquerorSelectionContext(state, action.nodeId);

    case "toggle-selection": {
      const selectedNodeIds = toggleKonquerorSelection(state.selectedNodeIds, action.nodeId);

      return selectedNodeIds === state.selectedNodeIds && state.rangeAnchorNodeId === action.nodeId
        ? state
        : { ...state, selectedNodeIds, rangeAnchorNodeId: action.nodeId };
    }

    case "replace-selection-range": {
      const rangeNodeIds = state.rangeAnchorNodeId === null
        ? null
        : getInclusiveKonquerorSelectionRange(
          action.visibleNodeIds,
          state.rangeAnchorNodeId,
          action.targetNodeId,
        );

      return rangeNodeIds === null
        ? replaceKonquerorSelectionContext(state, action.targetNodeId)
        : { ...state, selectedNodeIds: rangeNodeIds };
    }

    case "add-selection-range": {
      const rangeNodeIds = state.rangeAnchorNodeId === null
        ? null
        : getInclusiveKonquerorSelectionRange(
          action.visibleNodeIds,
          state.rangeAnchorNodeId,
          action.targetNodeId,
        );

      return rangeNodeIds === null
        ? replaceKonquerorSelectionContext(state, action.targetNodeId)
        : {
            ...state,
            selectedNodeIds: addKonquerorSelectionRange(state.selectedNodeIds, rangeNodeIds),
          };
    }

    case "commit-marquee-selection": {
      const hitNodeIds = retainKonquerorSelection(action.hitNodeIds, action.visibleNodeIds);
      if (action.mode === "replace") {
        return {
          ...state,
          selectedNodeIds: hitNodeIds,
          rangeAnchorNodeId: null,
        };
      }

      const baselineSelectedNodeIds = retainKonquerorSelection(
        normalizeKonquerorSelection(action.baselineSelectedNodeIds),
        action.visibleNodeIds,
      );
      const rangeAnchorNodeId = action.baselineRangeAnchorNodeId !== null &&
        action.visibleNodeIds.includes(action.baselineRangeAnchorNodeId)
        ? action.baselineRangeAnchorNodeId
        : null;

      return {
        ...state,
        selectedNodeIds: addKonquerorSelectionRange(baselineSelectedNodeIds, hitNodeIds),
        rangeAnchorNodeId,
      };
    }

    case "clear-selection":
      return clearKonquerorSelectionContext(state);

    case "retain-selection": {
      const selectedNodeIds = retainKonquerorSelection(state.selectedNodeIds, action.visibleNodeIds);
      const rangeAnchorNodeId = state.rangeAnchorNodeId !== null && action.visibleNodeIds.includes(state.rangeAnchorNodeId)
        ? state.rangeAnchorNodeId
        : null;

      return selectedNodeIds === state.selectedNodeIds && rangeAnchorNodeId === state.rangeAnchorNodeId
        ? state
        : { ...state, selectedNodeIds, rangeAnchorNodeId };
    }

    case "reset-location-draft":
      return {
        ...state,
        locationDraft: getKonquerorLocationDraft(getCurrentKonquerorLocationTarget(state), action.path),
        navigationError: null,
      };

    case "reload-success":
      return {
        ...state,
        locationDraft: getKonquerorLocationDraft(getCurrentKonquerorLocationTarget(state), action.path),
        navigationError: null,
      };

    case "mutation-success": {
      const selectedNodeIds = normalizeKonquerorSelection(action.selectedNodeIds);

      return {
        ...state,
        selectedNodeIds,
        rangeAnchorNodeId: getSingleKonquerorSelectedNodeId(selectedNodeIds),
        locationDraft: getKonquerorLocationDraft(getCurrentKonquerorLocationTarget(state), action.path),
        navigationError: null,
      };
    }

    case "prune-deleted-history":
      return removeDeletedNodesFromKonquerorHistory(
        state,
        action.deletedNodeIds,
        action.fallbackNodeId,
        action.fallbackPath,
      );

    default:
      return state;
  }
}

export function removeDeletedNodesFromKonquerorHistory(
  state: KonquerorNavigationState,
  deletedNodeIds: readonly VfsNodeId[],
  fallbackNodeId: VfsNodeId,
  fallbackPath: string,
): KonquerorNavigationState {
  const deleted = new Set(deletedNodeIds);
  const currentTarget = getCurrentKonquerorLocationTarget(state);
  const historyTargets = getKonquerorHistoryTargets(state).filter(
    (target) =>
      target.type === "sysinfo" ||
      target.type === "about-konqueror" ||
      target.type === "about-blank" ||
      target.type === "external-web" ||
      !deleted.has(target.nodeId),
  );
  const currentTargetSurvived =
    currentTarget !== null &&
    (currentTarget.type === "sysinfo" ||
      currentTarget.type === "about-konqueror" ||
      currentTarget.type === "about-blank" ||
      currentTarget.type === "external-web" ||
      !deleted.has(currentTarget.nodeId));

  if (currentTargetSurvived) {
    const historyIndex = historyTargets.findIndex((target) => sameTarget(target, currentTarget));

    return {
      historyTargets,
      historyIndex: historyIndex >= 0 ? historyIndex : 0,
      selectedNodeIds: emptyKonquerorSelection,
      rangeAnchorNodeId: null,
      locationDraft: state.locationDraft,
      navigationError: null,
    };
  }

  const fallbackTarget: KonquerorLocationTarget = { type: "directory", nodeId: fallbackNodeId };
  if (!historyTargets.some((target) => sameTarget(target, fallbackTarget))) {
    historyTargets.push(fallbackTarget);
  }

  const historyIndex = historyTargets.findIndex((target) => sameTarget(target, fallbackTarget));

  return {
    historyTargets,
    historyIndex,
    selectedNodeIds: emptyKonquerorSelection,
    rangeAnchorNodeId: null,
    locationDraft: fallbackPath,
    navigationError: null,
  };
}
