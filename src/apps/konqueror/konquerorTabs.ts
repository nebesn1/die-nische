import type { VfsNodeId } from "../../vfs/types";
import {
  createInitialKonquerorNavigationState,
  konquerorNavigationReducer,
} from "./navigationState";
import type { KonquerorNavigationAction, KonquerorNavigationState, KonquerorLocationTarget } from "./navigationTypes";
import {
  defaultKonquerorImageViewState,
  konquerorImageViewReducer,
  type KonquerorImageViewAction,
  type KonquerorImageViewState,
} from "./imageViewModel";
import {
  defaultKonquerorMediaViewState,
  konquerorMediaViewReducer,
  type KonquerorMediaViewAction,
  type KonquerorMediaViewState,
} from "./mediaViewModel";

export type KonquerorTabId = `tab-${number}`;

export interface KonquerorTabSession {
  readonly id: KonquerorTabId;
  readonly navigationState: KonquerorNavigationState;
  /** Tree expansion follows a navigation session; view mode, sort, and zoom remain window preferences. */
  readonly expandedTreeNodeIds: readonly VfsNodeId[];
  readonly imageViewState: KonquerorImageViewState;
  readonly mediaViewState: KonquerorMediaViewState;
}

export interface KonquerorWindowTabs {
  readonly tabs: readonly KonquerorTabSession[];
  readonly activeTabId: KonquerorTabId;
  readonly nextTabId: number;
}

export type KonquerorDetachedTabResult = {
  readonly source: KonquerorWindowTabs;
  readonly tab: KonquerorTabSession;
};

const createTabSession = (
  id: KonquerorTabId,
  target: KonquerorLocationTarget,
  homePath: string,
): KonquerorTabSession => ({
  id,
  navigationState: createInitialKonquerorNavigationState(target, homePath),
  expandedTreeNodeIds: [],
  imageViewState: defaultKonquerorImageViewState,
  mediaViewState: defaultKonquerorMediaViewState,
});

export function createInitialKonquerorWindowTabs(
  target: KonquerorLocationTarget,
  homePath: string,
): KonquerorWindowTabs {
  const first = createTabSession("tab-1", target, homePath);
  return { tabs: [first], activeTabId: first.id, nextTabId: 2 };
}

/** A detached session keeps its stable identity while gaining a new single-tab owner. */
export function createKonquerorWindowTabsFromDetachedTab(tab: KonquerorTabSession): KonquerorWindowTabs {
  const numericId = Number(tab.id.slice("tab-".length));
  return {
    tabs: [tab],
    activeTabId: tab.id,
    nextTabId: Number.isSafeInteger(numericId) && numericId >= 1 ? numericId + 1 : 2,
  };
}

export function getActiveKonquerorTab(state: KonquerorWindowTabs): KonquerorTabSession {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0]!;
}

export function getKonquerorTabById(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
): KonquerorTabSession | null {
  return state.tabs.find((tab) => tab.id === tabId) ?? null;
}

export function addKonquerorTab(
  state: KonquerorWindowTabs,
  target: KonquerorLocationTarget,
  homePath: string,
): KonquerorWindowTabs {
  const id = `tab-${state.nextTabId}` as KonquerorTabId;
  const tab = createTabSession(id, target, homePath);
  return {
    ...state,
    tabs: [...state.tabs, tab],
    activeTabId: id,
    nextTabId: state.nextTabId + 1,
  };
}

export function selectKonquerorTab(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
): KonquerorWindowTabs {
  return state.tabs.some((tab) => tab.id === tabId) ? { ...state, activeTabId: tabId } : state;
}

export function closeKonquerorTab(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
): KonquerorWindowTabs {
  if (state.tabs.length <= 1) {
    return state;
  }

  const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId);
  if (closedIndex < 0) {
    return state;
  }

  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  const fallback = tabs[Math.max(0, closedIndex - 1)] ?? tabs[0]!;
  return {
    ...state,
    tabs,
    activeTabId: state.activeTabId === tabId ? fallback.id : state.activeTabId,
  };
}

/** Captures first and only returns a source state when its last-tab invariant remains intact. */
export function detachKonquerorTab(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
): KonquerorDetachedTabResult | null {
  if (state.tabs.length <= 1) {
    return null;
  }

  const tab = getKonquerorTabById(state, tabId);
  if (tab === null) {
    return null;
  }

  return { source: closeKonquerorTab(state, tabId), tab };
}

export function updateKonquerorTabNavigation(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
  action: KonquerorNavigationAction,
): KonquerorWindowTabs {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const navigationState = konquerorNavigationReducer(tab.navigationState, action);
    if (navigationState === tab.navigationState) return tab;
    changed = true;
    return { ...tab, navigationState };
  });
  return changed ? { ...state, tabs } : state;
}

export function updateKonquerorTabTreeExpansion(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
  expandedTreeNodeIds: readonly VfsNodeId[],
): KonquerorWindowTabs {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId || tab.expandedTreeNodeIds === expandedTreeNodeIds) return tab;
    changed = true;
    return { ...tab, expandedTreeNodeIds };
  });
  return changed ? { ...state, tabs } : state;
}

export function updateKonquerorTabImageView(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
  action: KonquerorImageViewAction,
): KonquerorWindowTabs {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const imageViewState = konquerorImageViewReducer(tab.imageViewState, action);
    if (imageViewState === tab.imageViewState) return tab;
    changed = true;
    return { ...tab, imageViewState };
  });
  return changed ? { ...state, tabs } : state;
}

export function updateKonquerorTabMediaView(
  state: KonquerorWindowTabs,
  tabId: KonquerorTabId,
  action: KonquerorMediaViewAction,
): KonquerorWindowTabs {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const mediaViewState = konquerorMediaViewReducer(tab.mediaViewState, action);
    if (mediaViewState === tab.mediaViewState) return tab;
    changed = true;
    return { ...tab, mediaViewState };
  });
  return changed ? { ...state, tabs } : state;
}

export type KonquerorTabsAction =
  | { readonly type: "add"; readonly target: KonquerorLocationTarget; readonly homePath: string }
  | { readonly type: "select"; readonly tabId: KonquerorTabId }
  | { readonly type: "close"; readonly tabId: KonquerorTabId }
  | { readonly type: "navigation"; readonly tabId: KonquerorTabId; readonly action: KonquerorNavigationAction }
  | { readonly type: "image-view"; readonly tabId: KonquerorTabId; readonly action: KonquerorImageViewAction }
  | { readonly type: "media-view"; readonly tabId: KonquerorTabId; readonly action: KonquerorMediaViewAction }
  | { readonly type: "tree-expansion"; readonly tabId: KonquerorTabId; readonly expandedTreeNodeIds: readonly VfsNodeId[] };

export function konquerorTabsReducer(state: KonquerorWindowTabs, action: KonquerorTabsAction): KonquerorWindowTabs {
  switch (action.type) {
    case "add": return addKonquerorTab(state, action.target, action.homePath);
    case "select": return selectKonquerorTab(state, action.tabId);
    case "close": return closeKonquerorTab(state, action.tabId);
    case "navigation": return updateKonquerorTabNavigation(state, action.tabId, action.action);
    case "image-view": return updateKonquerorTabImageView(state, action.tabId, action.action);
    case "media-view": return updateKonquerorTabMediaView(state, action.tabId, action.action);
    case "tree-expansion": return updateKonquerorTabTreeExpansion(state, action.tabId, action.expandedTreeNodeIds);
  }
}
