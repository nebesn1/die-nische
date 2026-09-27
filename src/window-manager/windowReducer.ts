import { clampNormalWindowDragBounds, clampWindowBounds, getMaximizedBounds, moveWindowBounds } from "./geometry";
import { clampWindowToMobileSafeRect, containWindowInMobileSafeRect, fitWindowToMobileWorkArea } from "./responsiveGeometry";
import { disambiguateWindowCaptions } from "./windowCaptionDisambiguation";
import {
  DEFAULT_DESKTOP_ID,
  DEFAULT_DESKTOP_COUNT,
  normalizeDesktopCount,
  type DesktopId,
  type DesktopWindow,
  type RestorableWindowState,
  type ScreenArea,
  type ShowDesktopSession,
  type WindowBounds,
  type WindowLauncherMetadata,
  type WindowLayoutMode,
  type WindowBoundsByLayoutMode,
  type WorkArea,
  isWindowMaximizable,
  isWindowMinimizable,
  isWindowAlwaysOnTop,
  getWindowLayeredZIndex,
  getWindowZIndexSequence,
  isWindowPresentedMaximized,
} from "./types";
import { getMobileWindowPresentationPolicy, shouldKeepWindowFullyContained } from "./mobileWindowPresentation";

export interface WindowManagerState {
  windows: DesktopWindow[];
  currentDesktopId: DesktopId;
  desktopCount?: number;
  lastActiveWindowIdByDesktop: Record<DesktopId, string | null>;
  showDesktopSessionByDesktop: Record<DesktopId, ShowDesktopSession | null>;
  launcherMetadataByWindowId: Record<string, WindowLauncherMetadata | undefined>;
  nextZIndex: number;
  nextFocusRequestId?: number;
  workArea: WorkArea;
  layoutMode: WindowLayoutMode;
}

export type WindowManagerAction =
  | { type: "activateWindow"; id: string }
  | { type: "moveWindow"; id: string; x: number; y: number; screenArea?: ScreenArea }
  | { type: "resizeWindow"; id: string; bounds: WindowBounds }
  | { type: "fitWindowToContent"; id: string; bounds: WindowBounds }
  | { type: "minimizeWindow"; id: string }
  | { type: "restoreWindow"; id: string }
  | { type: "maximizeWindow"; id: string }
  | { type: "restoreMaximizedWindow"; id: string }
  | { type: "toggleMaximizeWindow"; id: string }
  | { type: "closeWindow"; id: string }
  | { type: "setWindowTitle"; id: string; title: string }
  | { type: "setWindowLauncherMetadata"; id: string; metadata: WindowLauncherMetadata | null }
  | { type: "toggleTaskbarWindow"; id: string }
  | { type: "openWindow"; window: DesktopWindow }
  | { type: "focusWindow"; id: string }
  | { type: "switchDesktop"; desktopId: DesktopId }
  | { type: "setDesktopCount"; desktopCount: number }
  | { type: "toggleShowDesktop"; desktopId: DesktopId }
  | { type: "moveWindowToDesktop"; id: string; desktopId: DesktopId }
  | { type: "resetSession" }
  | { type: "setWorkArea"; workArea: WorkArea; screenArea?: ScreenArea; layoutMode?: WindowLayoutMode }
  | { type: "registerWindow"; window: DesktopWindow };

const getTopZIndex = (windows: readonly DesktopWindow[]): number => {
  return windows.reduce((highest, window) => Math.max(highest, getWindowZIndexSequence(window.zIndex)), 0);
};

const hasWindow = (windows: readonly DesktopWindow[], id: string): boolean => {
  return windows.some((window) => window.id === id);
};

const withDisambiguatedTitles = (windows: readonly DesktopWindow[]): DesktopWindow[] =>
  [...disambiguateWindowCaptions(windows)];

export const createEmptyLastActiveWindowRecord = (desktopCount = DEFAULT_DESKTOP_COUNT): Record<DesktopId, string | null> =>
  Object.fromEntries(Array.from({ length: desktopCount }, (_, index) => [index + 1, null]));

export const createEmptyShowDesktopSessionRecord = (desktopCount = DEFAULT_DESKTOP_COUNT): Record<DesktopId, ShowDesktopSession | null> =>
  Object.fromEntries(Array.from({ length: desktopCount }, (_, index) => [index + 1, null]));

const getScreenAreaForWorkArea = (workArea: WorkArea): ScreenArea => ({
  x: workArea.x,
  y: workArea.y,
  width: workArea.width,
  height: workArea.height,
});

const copyBounds = (bounds: WindowBounds): WindowBounds => ({ ...bounds });

const copyBoundsByMode = (boundsByMode: WindowBoundsByLayoutMode | undefined): WindowBoundsByLayoutMode => ({
  ...(boundsByMode?.desktop ? { desktop: copyBounds(boundsByMode.desktop) } : {}),
  ...(boundsByMode?.mobile ? { mobile: copyBounds(boundsByMode.mobile) } : {}),
});

const setBoundsProfile = (
  boundsByMode: WindowBoundsByLayoutMode | undefined,
  layoutMode: WindowLayoutMode,
  bounds: WindowBounds,
): WindowBoundsByLayoutMode => ({
  ...copyBoundsByMode(boundsByMode),
  [layoutMode]: copyBounds(bounds),
});

const removeBoundsProfile = (
  boundsByMode: WindowBoundsByLayoutMode | undefined,
  layoutMode: WindowLayoutMode,
): WindowBoundsByLayoutMode | undefined => {
  const next = copyBoundsByMode(boundsByMode);
  delete next[layoutMode];
  return Object.keys(next).length > 0 ? next : undefined;
};

const getNormalProfile = (
  window: DesktopWindow,
  layoutMode: WindowLayoutMode,
): WindowBounds | undefined => window.normalBoundsByMode?.[layoutMode];

const getNormalBoundsForMode = (
  window: DesktopWindow,
  layoutMode: WindowLayoutMode,
): WindowBounds | undefined => {
  const profile = getNormalProfile(window, layoutMode);

  if (profile) {
    return copyBounds(profile);
  }

  if (window.state === "normal" || (window.state === "minimized" && window.stateBeforeMinimize === "normal")) {
    return copyBounds(window.bounds);
  }

  return window.restoreBoundsByMode?.[layoutMode]
    ? copyBounds(window.restoreBoundsByMode[layoutMode]!)
    : window.restoreBounds
      ? copyBounds(window.restoreBounds)
      : window.preferredBounds
        ? copyBounds(window.preferredBounds)
        : undefined;
};

const isRestoredMaximizedWindow = (window: DesktopWindow): boolean =>
  window.state === "maximized" || (window.state === "minimized" && window.stateBeforeMinimize === "maximized");

const shouldPresentMaximized = (window: DesktopWindow, layoutMode: WindowLayoutMode): boolean =>
  (layoutMode === "mobile" && getMobileWindowPresentationPolicy(window.appId) === "normal")
    ? false
    : isRestoredMaximizedWindow(window) || isWindowPresentedMaximized(window, layoutMode);

const setCurrentNormalProfile = (
  window: DesktopWindow,
  layoutMode: WindowLayoutMode,
  bounds: WindowBounds,
): DesktopWindow => ({
  ...window,
  bounds: copyBounds(bounds),
  normalBoundsByMode: setBoundsProfile(window.normalBoundsByMode, layoutMode, bounds),
});

const getDesktopProfileForWindow = (window: DesktopWindow, workArea: WorkArea): WindowBounds | undefined => {
  const preferredBounds = window.preferredBounds ?? getNormalBoundsForMode(window, "desktop");

  if (!preferredBounds) {
    return undefined;
  }

  const width = Math.max(1, Number.isFinite(preferredBounds.width) ? preferredBounds.width : 1);
  const height = Math.max(1, Number.isFinite(preferredBounds.height) ? preferredBounds.height : 1);

  return clampWindowBounds(
    {
      ...preferredBounds,
      x: workArea.x + (workArea.width - width) / 2,
      y: workArea.y + (workArea.height - height) / 2,
      width,
      height,
    },
    workArea,
  );
};

const resolveProfileForMode = (
  window: DesktopWindow,
  layoutMode: WindowLayoutMode,
  workArea: WorkArea,
  sourceBounds?: WindowBounds,
  screenArea?: ScreenArea,
): WindowBounds | undefined => {
  const existing = getNormalProfile(window, layoutMode);

  if (existing) {
    if (layoutMode === "mobile") {
      return getMobileWindowPresentationPolicy(window.appId) === "normal"
        ? fitWindowToMobileWorkArea(existing, workArea)
        : containWindowInMobileSafeRect(existing, workArea);
    }

    return shouldKeepWindowFullyContained(window.appId)
      ? clampWindowBounds(existing, workArea)
      : screenArea
        ? clampNormalWindowDragBounds(existing, screenArea, workArea)
        : clampWindowBounds(existing, workArea);
  }

  if (layoutMode === "mobile") {
    const isMobileNormalWindow = getMobileWindowPresentationPolicy(window.appId) === "normal";
    const mobileSourceBounds = isMobileNormalWindow
      ? sourceBounds ?? window.preferredBounds ?? window.bounds
      : sourceBounds ?? window.bounds;

    return isMobileNormalWindow
      ? fitWindowToMobileWorkArea(mobileSourceBounds, workArea, window.minimumWidth, window.minimumHeight)
      : clampWindowToMobileSafeRect(
        mobileSourceBounds,
        workArea,
        window.minimumWidth,
        window.minimumHeight,
      );
  }

  const desktopBounds = getDesktopProfileForWindow(
    sourceBounds ? { ...window, preferredBounds: sourceBounds } : window,
    workArea,
  );

  return desktopBounds && screenArea
    ? clampNormalWindowDragBounds(desktopBounds, screenArea, workArea)
    : desktopBounds;
};

const normalizeWindowForMode = (
  window: DesktopWindow,
  layoutMode: WindowLayoutMode,
  workArea: WorkArea,
): DesktopWindow => {
  const sourceBounds = isRestoredMaximizedWindow(window)
    ? window.restoreBounds ?? window.bounds
    : window.bounds;
  const normalBounds = layoutMode === "desktop" && !window.normalBoundsByMode?.desktop
    ? clampWindowBounds(sourceBounds, workArea)
    : resolveProfileForMode(window, layoutMode, workArea, sourceBounds);
  const profiles = normalBounds
    ? setBoundsProfile(window.normalBoundsByMode, layoutMode, normalBounds)
    : copyBoundsByMode(window.normalBoundsByMode);
  const currentBounds = shouldPresentMaximized(window, layoutMode)
    ? getMaximizedBounds(workArea)
    : normalBounds ?? window.bounds;
  const restoreBounds = isRestoredMaximizedWindow(window)
    ? normalBounds
    : window.restoreBounds;

  return {
    ...window,
    bounds: copyBounds(currentBounds),
    normalBoundsByMode: profiles,
    restoreBounds: restoreBounds && layoutMode === "desktop" ? copyBounds(restoreBounds) : window.restoreBounds,
    restoreBoundsByMode: isRestoredMaximizedWindow(window)
      ? restoreBounds
        ? setBoundsProfile(window.restoreBoundsByMode, layoutMode, restoreBounds)
        : window.restoreBoundsByMode
      : window.restoreBoundsByMode,
  };
};

const reconcileWindowForWorkArea = (
  window: DesktopWindow,
  previousMode: WindowLayoutMode,
  nextMode: WindowLayoutMode,
  workArea: WorkArea,
  screenArea: ScreenArea,
): DesktopWindow => {
  const previousNormal = getNormalBoundsForMode(window, previousMode);
  const seededWindow = previousNormal
    ? {
        ...window,
        normalBoundsByMode: setBoundsProfile(window.normalBoundsByMode, previousMode, previousNormal),
      }
    : window;
  const nextNormal = resolveProfileForMode(
    seededWindow,
    nextMode,
    workArea,
    nextMode === "desktop" && previousMode === "mobile"
      ? undefined
      : previousNormal ?? window.bounds,
    screenArea,
  );
  const isMaximized = shouldPresentMaximized(window, nextMode);
  const preservesUserMaximizedState = isRestoredMaximizedWindow(window);
  const currentBounds = isMaximized
    ? getMaximizedBounds(workArea)
    : nextNormal ?? window.bounds;

  return {
    ...seededWindow,
    bounds: copyBounds(currentBounds),
    normalBoundsByMode: nextNormal
      ? setBoundsProfile(seededWindow.normalBoundsByMode, nextMode, nextNormal)
      : seededWindow.normalBoundsByMode,
    restoreBounds: preservesUserMaximizedState && nextNormal && nextMode === "desktop"
      ? copyBounds(nextNormal)
      : window.restoreBounds,
    restoreBoundsByMode: preservesUserMaximizedState && nextNormal
      ? setBoundsProfile(seededWindow.restoreBoundsByMode, nextMode, nextNormal)
      : seededWindow.restoreBoundsByMode,
  };
};

const resetWindowSession = (state: WindowManagerState): WindowManagerState => ({
  ...state,
  windows: [],
  currentDesktopId: DEFAULT_DESKTOP_ID,
  lastActiveWindowIdByDesktop: createEmptyLastActiveWindowRecord(state.desktopCount ?? DEFAULT_DESKTOP_COUNT),
  showDesktopSessionByDesktop: createEmptyShowDesktopSessionRecord(state.desktopCount ?? DEFAULT_DESKTOP_COUNT),
  launcherMetadataByWindowId: {},
  nextZIndex: 1,
});

export const isDesktopId = (value: number): value is DesktopId => {
  return Number.isInteger(value) && value >= DEFAULT_DESKTOP_ID;
};

const isRestorableWindowState = (state: DesktopWindow["state"]): state is RestorableWindowState => {
  return state === "normal" || state === "maximized";
};

const getTopVisibleWindow = (
  windows: readonly DesktopWindow[],
  desktopId: DesktopId,
  excludedId?: string,
): DesktopWindow | undefined => {
  return windows
    .filter((window) => window.id !== excludedId && window.desktopId === desktopId && window.state !== "minimized")
    .reduce<DesktopWindow | undefined>((topWindow, window) => {
      if (
        !topWindow
        || (isWindowAlwaysOnTop(window) && !isWindowAlwaysOnTop(topWindow))
        || (isWindowAlwaysOnTop(window) === isWindowAlwaysOnTop(topWindow) && window.zIndex > topWindow.zIndex)
      ) {
        return window;
      }

      return topWindow;
    }, undefined);
};

const getActiveWindow = (windows: readonly DesktopWindow[], desktopId: DesktopId): DesktopWindow | undefined => {
  return windows.find((window) => window.desktopId === desktopId && window.isActive && window.state !== "minimized");
};

const resolveDesktopActiveWindow = (
  windows: readonly DesktopWindow[],
  desktopId: DesktopId,
  lastActiveWindowId: string | null,
): DesktopWindow | undefined => {
  const lastActiveWindow = lastActiveWindowId
    ? windows.find(
        (window) =>
          window.id === lastActiveWindowId && window.desktopId === desktopId && window.state !== "minimized",
      )
    : undefined;

  return lastActiveWindow ?? getTopVisibleWindow(windows, desktopId);
};

const isWindowHiddenByShowDesktop = (state: WindowManagerState, windowId: string, desktopId: DesktopId): boolean => {
  return state.showDesktopSessionByDesktop[desktopId]?.windowIds.includes(windowId) ?? false;
};

const getNextFocusRequestId = (state: WindowManagerState): number => state.nextFocusRequestId ?? 1;

const withFocusRequest = (window: DesktopWindow, focusRequestId: number): DesktopWindow => ({
  ...window,
  focusRequestId,
});

const removeWindowFromShowDesktopSession = (
  sessions: Record<DesktopId, ShowDesktopSession | null>,
  desktopId: DesktopId,
  windowId: string,
): Record<DesktopId, ShowDesktopSession | null> => {
  const session = sessions[desktopId];

  if (!session || !session.windowIds.includes(windowId)) {
    return sessions;
  }

  const windowIds = session.windowIds.filter((id) => id !== windowId);

  return {
    ...sessions,
    [desktopId]:
      windowIds.length > 0
        ? {
            windowIds,
            previouslyActiveWindowId:
              session.previouslyActiveWindowId === windowId ? null : session.previouslyActiveWindowId,
          }
        : null,
  };
};

const clearShowDesktopSession = (
  state: WindowManagerState,
  desktopId: DesktopId,
): WindowManagerState => {
  if (!state.showDesktopSessionByDesktop[desktopId]) {
    return state;
  }

  return {
    ...state,
    showDesktopSessionByDesktop: {
      ...state.showDesktopSessionByDesktop,
      [desktopId]: null,
    },
  };
};

const addWindowToShowDesktopSession = (
  sessions: Record<DesktopId, ShowDesktopSession | null>,
  desktopId: DesktopId,
  windowId: string,
): Record<DesktopId, ShowDesktopSession | null> => {
  const session = sessions[desktopId];

  if (!session || session.windowIds.includes(windowId)) {
    return sessions;
  }

  return {
    ...sessions,
    [desktopId]: {
      ...session,
      windowIds: [...session.windowIds, windowId],
    },
  };
};

const fallbackRestoreBounds = (window: DesktopWindow, workArea: WorkArea): WindowBounds => {
  return clampWindowBounds(
    {
      ...window.bounds,
      width: Math.min(Math.max(window.bounds.width, 240), Math.max(workArea.width, 240)),
      height: Math.min(Math.max(window.bounds.height, 160), Math.max(workArea.height, 160)),
    },
    workArea,
  );
};

const activateWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  if (!hasWindow(state.windows, id)) {
    return state;
  }

  const target = state.windows.find((window) => window.id === id);

  if (!target || target.state === "minimized" || target.desktopId !== state.currentDesktopId) {
    return state;
  }

  const stateAfterShowDesktop = clearShowDesktopSession(state, state.currentDesktopId);
  const topVisibleZIndex = getTopVisibleWindow(stateAfterShowDesktop.windows, stateAfterShowDesktop.currentDesktopId)?.zIndex ?? 0;
  const focusRequestId = getNextFocusRequestId(state);

  if (!isWindowHiddenByShowDesktop(state, target.id, target.desktopId) && target.isActive && target.zIndex === topVisibleZIndex) {
    return {
      ...state,
      windows: state.windows.map((window) => window.id === id ? withFocusRequest(window, focusRequestId) : window),
      nextFocusRequestId: focusRequestId + 1,
    };
  }

  return {
    ...stateAfterShowDesktop,
    windows: stateAfterShowDesktop.windows.map((window) => ({
      ...window,
      isActive: window.id === id && window.desktopId === stateAfterShowDesktop.currentDesktopId,
      zIndex: window.id === id ? getWindowLayeredZIndex(state.nextZIndex, window) : window.zIndex,
      ...(window.id === id ? { focusRequestId } : {}),
    })),
    lastActiveWindowIdByDesktop: {
      ...stateAfterShowDesktop.lastActiveWindowIdByDesktop,
      [stateAfterShowDesktop.currentDesktopId]: id,
    },
    nextZIndex: state.nextZIndex + 1,
    nextFocusRequestId: focusRequestId + 1,
  };
};

const minimizeWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  const target = state.windows.find((window) => window.id === id);

  if (!target || !isWindowMinimizable(target) || target.state === "minimized") {
    return state;
  }

  // Mobile presents visible windows maximized and deliberately has no minimize
  // affordance. Keep this guard at the reducer boundary for runtime/taskbar
  // callers that bypass the caption and system-menu presentation.
  if (state.layoutMode === "mobile") {
    return state;
  }

  const fallbackWindow = target.isActive ? getTopVisibleWindow(state.windows, target.desktopId, id) : undefined;
  const stateBeforeMinimize: RestorableWindowState = isRestorableWindowState(target.state) ? target.state : "normal";
  const shouldClearLastActive = state.lastActiveWindowIdByDesktop[target.desktopId] === id;
  const fallbackFocusRequestId = target.isActive && fallbackWindow ? getNextFocusRequestId(state) : null;
  const showDesktopSessionByDesktop = removeWindowFromShowDesktopSession(
    state.showDesktopSessionByDesktop,
    target.desktopId,
    id,
  );

  return {
    ...state,
    windows: state.windows.map((window) => {
      if (window.id === id) {
        return {
          ...window,
          state: "minimized",
          isActive: false,
          stateBeforeMinimize,
        };
      }

      if (!target.isActive) {
        return window;
      }

      return {
        ...window,
        isActive:
          window.desktopId === state.currentDesktopId && fallbackWindow ? window.id === fallbackWindow.id : false,
        ...(fallbackFocusRequestId !== null && window.id === fallbackWindow?.id ? { focusRequestId: fallbackFocusRequestId } : {}),
      };
    }),
    lastActiveWindowIdByDesktop: shouldClearLastActive
      ? {
          ...state.lastActiveWindowIdByDesktop,
          [target.desktopId]: fallbackWindow?.id ?? null,
        }
      : state.lastActiveWindowIdByDesktop,
    showDesktopSessionByDesktop,
    ...(fallbackFocusRequestId !== null ? { nextFocusRequestId: fallbackFocusRequestId + 1 } : {}),
  };
};

const restoreWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  const target = state.windows.find((window) => window.id === id);

  if (!target) {
    return state;
  }

  if (target.desktopId !== state.currentDesktopId) {
    return state;
  }

  if (target.state !== "minimized") {
    return activateWindowById(state, id);
  }

  const stateAfterShowDesktop = clearShowDesktopSession(state, state.currentDesktopId);
  const focusRequestId = getNextFocusRequestId(state);
  const restoredState = target.stateBeforeMinimize ?? "normal";
  const restoredNormalBounds = restoredState === "maximized"
    ? getNormalBoundsForMode(target, state.layoutMode)
    : state.layoutMode === "mobile"
      ? containWindowInMobileSafeRect(
        getNormalBoundsForMode(target, state.layoutMode) ?? target.bounds,
        stateAfterShowDesktop.workArea,
      )
      : getNormalBoundsForMode(target, state.layoutMode) ?? target.bounds;
  const restoredBounds = restoredState === "maximized"
    || (state.layoutMode === "mobile" && restoredState === "normal")
    ? getMaximizedBounds(stateAfterShowDesktop.workArea)
    : restoredNormalBounds ?? target.bounds;

  return {
    ...stateAfterShowDesktop,
    windows: stateAfterShowDesktop.windows.map((window) => ({
      ...window,
      state: window.id === id ? restoredState : window.state,
      bounds: window.id === id ? restoredBounds : window.bounds,
      normalBoundsByMode: window.id === id && restoredState === "normal"
        ? setBoundsProfile(window.normalBoundsByMode, state.layoutMode, restoredNormalBounds ?? restoredBounds)
        : window.normalBoundsByMode,
      isActive: window.id === id && window.desktopId === stateAfterShowDesktop.currentDesktopId,
      zIndex: window.id === id ? getWindowLayeredZIndex(state.nextZIndex, window) : window.zIndex,
      stateBeforeMinimize: window.id === id ? undefined : window.stateBeforeMinimize,
      ...(window.id === id ? { focusRequestId } : {}),
    })),
    lastActiveWindowIdByDesktop: {
      ...stateAfterShowDesktop.lastActiveWindowIdByDesktop,
      [stateAfterShowDesktop.currentDesktopId]: id,
    },
    nextZIndex: state.nextZIndex + 1,
    nextFocusRequestId: focusRequestId + 1,
  };
};

const maximizeWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  const target = state.windows.find((window) => window.id === id);

  if (!target || !isWindowMaximizable(target) || target.state === "minimized" || target.desktopId !== state.currentDesktopId) {
    return state;
  }

  if (state.layoutMode === "mobile") {
    return state;
  }

  const topVisibleZIndex = getTopVisibleWindow(state.windows, state.currentDesktopId)?.zIndex ?? 0;

  if (target.state === "maximized" && target.isActive && target.zIndex === topVisibleZIndex) {
    return state;
  }

  const stateAfterShowDesktop = clearShowDesktopSession(state, state.currentDesktopId);
  const restoreBounds = target.state === "normal"
    ? target.bounds
    : target.restoreBoundsByMode?.[state.layoutMode] ?? target.restoreBounds ?? getNormalBoundsForMode(target, state.layoutMode);

  return {
    ...stateAfterShowDesktop,
    windows: stateAfterShowDesktop.windows.map((window) => ({
      ...window,
      state: window.id === id ? "maximized" : window.state,
      bounds: window.id === id ? getMaximizedBounds(stateAfterShowDesktop.workArea) : window.bounds,
      restoreBounds: window.id === id ? restoreBounds : window.restoreBounds,
      normalBoundsByMode: window.id === id && restoreBounds
        ? setBoundsProfile(window.normalBoundsByMode, state.layoutMode, restoreBounds)
        : window.normalBoundsByMode,
      restoreBoundsByMode: window.id === id && restoreBounds
        ? setBoundsProfile(window.restoreBoundsByMode, state.layoutMode, restoreBounds)
        : window.restoreBoundsByMode,
      isActive: window.id === id && window.desktopId === stateAfterShowDesktop.currentDesktopId,
      zIndex: window.id === id ? getWindowLayeredZIndex(state.nextZIndex, window) : window.zIndex,
    })),
    lastActiveWindowIdByDesktop: {
      ...stateAfterShowDesktop.lastActiveWindowIdByDesktop,
      [stateAfterShowDesktop.currentDesktopId]: id,
    },
    nextZIndex: state.nextZIndex + 1,
  };
};

const restoreMaximizedWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  const target = state.windows.find((window) => window.id === id);

  if (!target) {
    return state;
  }

  if (target.desktopId !== state.currentDesktopId) {
    return state;
  }

  if (state.layoutMode === "mobile" && target.state !== "minimized") {
    return state;
  }

  if (target.state !== "maximized") {
    return activateWindowById(state, id);
  }

  const stateAfterShowDesktop = clearShowDesktopSession(state, state.currentDesktopId);
  const restoredBounds = target.restoreBoundsByMode?.[state.layoutMode]
    ?? target.restoreBounds
    ?? getNormalBoundsForMode(target, state.layoutMode)
    ?? fallbackRestoreBounds(target, stateAfterShowDesktop.workArea);
  const normalizedRestoredBounds = state.layoutMode === "mobile"
    ? containWindowInMobileSafeRect(
      restoredBounds,
      stateAfterShowDesktop.workArea,
    )
    : restoredBounds;

  return {
    ...stateAfterShowDesktop,
    windows: stateAfterShowDesktop.windows.map((window) => ({
      ...window,
      state: window.id === id ? "normal" : window.state,
      bounds: window.id === id ? normalizedRestoredBounds : window.bounds,
      restoreBounds: window.id === id ? undefined : window.restoreBounds,
      normalBoundsByMode: window.id === id
        ? setBoundsProfile(window.normalBoundsByMode, state.layoutMode, normalizedRestoredBounds)
        : window.normalBoundsByMode,
      restoreBoundsByMode: window.id === id
        ? removeBoundsProfile(window.restoreBoundsByMode, state.layoutMode)
        : window.restoreBoundsByMode,
      isActive: window.id === id && window.desktopId === stateAfterShowDesktop.currentDesktopId,
      zIndex: window.id === id ? getWindowLayeredZIndex(state.nextZIndex, window) : window.zIndex,
    })),
    lastActiveWindowIdByDesktop: {
      ...stateAfterShowDesktop.lastActiveWindowIdByDesktop,
      [stateAfterShowDesktop.currentDesktopId]: id,
    },
    nextZIndex: state.nextZIndex + 1,
  };
};

const closeWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  const target = state.windows.find((window) => window.id === id);

  if (!target) {
    return state;
  }

  const remainingWindows = withDisambiguatedTitles(state.windows.filter((window) => window.id !== id));
  const fallbackWindow = target.isActive ? getTopVisibleWindow(remainingWindows, target.desktopId) : undefined;
  const shouldClearLastActive = state.lastActiveWindowIdByDesktop[target.desktopId] === id;
  const fallbackFocusRequestId = target.isActive && fallbackWindow ? getNextFocusRequestId(state) : null;
  const showDesktopSessionByDesktop = removeWindowFromShowDesktopSession(
    state.showDesktopSessionByDesktop,
    target.desktopId,
    id,
  );
  const launcherMetadataByWindowId = { ...state.launcherMetadataByWindowId };
  delete launcherMetadataByWindowId[id];

  return {
    ...state,
    windows: remainingWindows.map((window) => {
      if (!target.isActive) {
        return window;
      }

      return {
        ...window,
        isActive:
          window.desktopId === state.currentDesktopId && fallbackWindow ? window.id === fallbackWindow.id : false,
        ...(fallbackFocusRequestId !== null && window.id === fallbackWindow?.id ? { focusRequestId: fallbackFocusRequestId } : {}),
      };
    }),
    lastActiveWindowIdByDesktop: shouldClearLastActive
      ? {
          ...state.lastActiveWindowIdByDesktop,
          [target.desktopId]: fallbackWindow?.id ?? null,
        }
      : state.lastActiveWindowIdByDesktop,
    showDesktopSessionByDesktop,
    launcherMetadataByWindowId,
    ...(fallbackFocusRequestId !== null ? { nextFocusRequestId: fallbackFocusRequestId + 1 } : {}),
  };
};

const focusWindowById = (state: WindowManagerState, id: string): WindowManagerState => {
  const target = state.windows.find((window) => window.id === id);

  if (!target) {
    return state;
  }

  const stateAfterShowDesktop = clearShowDesktopSession(state, target.desktopId);
  const focusRequestId = getNextFocusRequestId(state);
  const restoredState = target.state === "minimized" ? target.stateBeforeMinimize ?? "normal" : target.state;
  const restoredNormalBounds =
    target.state === "minimized" && restoredState === "maximized"
      ? getNormalBoundsForMode(target, state.layoutMode)
      : target.state === "minimized"
        ? state.layoutMode === "mobile"
          ? containWindowInMobileSafeRect(
            getNormalBoundsForMode(target, state.layoutMode) ?? target.bounds,
            stateAfterShowDesktop.workArea,
          )
          : clampWindowBounds(getNormalBoundsForMode(target, state.layoutMode) ?? target.bounds, stateAfterShowDesktop.workArea)
        : target.bounds;
  const restoredBounds = target.state === "minimized" && (
    restoredState === "maximized" || (state.layoutMode === "mobile" && restoredState === "normal")
  )
    ? getMaximizedBounds(stateAfterShowDesktop.workArea)
    : restoredNormalBounds ?? target.bounds;

  return {
    ...stateAfterShowDesktop,
    currentDesktopId: target.desktopId,
    windows: stateAfterShowDesktop.windows.map((window) => ({
      ...window,
      state: window.id === id ? restoredState : window.state,
      bounds: window.id === id ? restoredBounds : window.bounds,
      normalBoundsByMode: window.id === id && restoredState === "normal"
        ? setBoundsProfile(window.normalBoundsByMode, state.layoutMode, restoredNormalBounds ?? restoredBounds)
        : window.normalBoundsByMode,
      isActive: window.id === id,
      zIndex: window.id === id ? getWindowLayeredZIndex(state.nextZIndex, window) : window.zIndex,
      stateBeforeMinimize: window.id === id ? undefined : window.stateBeforeMinimize,
      ...(window.id === id ? { focusRequestId } : {}),
    })),
    lastActiveWindowIdByDesktop: {
      ...stateAfterShowDesktop.lastActiveWindowIdByDesktop,
      [target.desktopId]: id,
    },
    nextZIndex: state.nextZIndex + 1,
    nextFocusRequestId: focusRequestId + 1,
  };
};

const switchDesktopById = (state: WindowManagerState, desktopId: DesktopId): WindowManagerState => {
  if (desktopId < 1 || desktopId > (state.desktopCount ?? DEFAULT_DESKTOP_COUNT)) {
    return state;
  }

  if (desktopId === state.currentDesktopId) {
    return state;
  }

  const leavingActiveWindow = getActiveWindow(state.windows, state.currentDesktopId);
  const nextLastActiveRecord = {
    ...state.lastActiveWindowIdByDesktop,
    [state.currentDesktopId]:
      leavingActiveWindow?.id ?? state.lastActiveWindowIdByDesktop[state.currentDesktopId] ?? null,
  };
  const targetActiveWindow = resolveDesktopActiveWindow(
    state.windows,
    desktopId,
    nextLastActiveRecord[desktopId],
  );
  const targetShowDesktopSession = state.showDesktopSessionByDesktop[desktopId];
  const focusRequestId = targetShowDesktopSession || !targetActiveWindow ? null : getNextFocusRequestId(state);

  return {
    ...state,
    currentDesktopId: desktopId,
    lastActiveWindowIdByDesktop: {
      ...nextLastActiveRecord,
      [desktopId]: targetShowDesktopSession ? nextLastActiveRecord[desktopId] : targetActiveWindow?.id ?? null,
    },
    windows: state.windows.map((window) => ({
      ...window,
      isActive: !targetShowDesktopSession && targetActiveWindow ? window.id === targetActiveWindow.id : false,
      ...(focusRequestId !== null && window.id === targetActiveWindow?.id ? { focusRequestId } : {}),
    })),
    ...(focusRequestId !== null ? { nextFocusRequestId: focusRequestId + 1 } : {}),
  };
};

const setDesktopCount = (state: WindowManagerState, requestedCount: number): WindowManagerState => {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    return state;
  }

  const desktopCount = normalizeDesktopCount(requestedCount);

  if (desktopCount === (state.desktopCount ?? DEFAULT_DESKTOP_COUNT)) return state;

  const currentDesktopId = Math.min(state.currentDesktopId, desktopCount);
  const windows = state.windows.map((window) => ({
    ...window,
    desktopId: Math.min(window.desktopId, desktopCount),
    isActive: false,
  }));
  const lastActiveWindowIdByDesktop = createEmptyLastActiveWindowRecord(desktopCount);
  const showDesktopSessionByDesktop = createEmptyShowDesktopSessionRecord(desktopCount);
  const activeWindow = getTopVisibleWindow(windows, currentDesktopId);

  if (activeWindow) lastActiveWindowIdByDesktop[currentDesktopId] = activeWindow.id;

  return {
    ...state,
    desktopCount,
    currentDesktopId,
    windows: windows.map((window) => ({ ...window, isActive: window.id === activeWindow?.id })),
    lastActiveWindowIdByDesktop,
    showDesktopSessionByDesktop,
  };
};

const restoreShowDesktopById = (state: WindowManagerState, desktopId: DesktopId): WindowManagerState => {
  const session = state.showDesktopSessionByDesktop[desktopId];

  if (!session) {
    return state;
  }

  const previouslyActiveWindow = session.previouslyActiveWindowId
    ? state.windows.find(
        (window) =>
          window.id === session.previouslyActiveWindowId &&
          window.desktopId === desktopId &&
          window.state !== "minimized",
      )
    : undefined;
  const activeWindow = previouslyActiveWindow ?? getTopVisibleWindow(state.windows, desktopId);
  const focusRequestId = activeWindow ? getNextFocusRequestId(state) : null;

  return {
    ...state,
    windows: state.windows.map((window) => ({
      ...window,
      isActive: window.desktopId === desktopId && activeWindow ? window.id === activeWindow.id : false,
      ...(focusRequestId !== null && window.id === activeWindow?.id ? { focusRequestId } : {}),
    })),
    lastActiveWindowIdByDesktop: {
      ...state.lastActiveWindowIdByDesktop,
      [desktopId]: activeWindow?.id ?? null,
    },
    showDesktopSessionByDesktop: {
      ...state.showDesktopSessionByDesktop,
      [desktopId]: null,
    },
    ...(focusRequestId !== null ? { nextFocusRequestId: focusRequestId + 1 } : {}),
  };
};

const toggleShowDesktopById = (state: WindowManagerState, desktopId: DesktopId): WindowManagerState => {
  if (desktopId > (state.desktopCount ?? DEFAULT_DESKTOP_COUNT)) {
    return state;
  }

  if (state.showDesktopSessionByDesktop[desktopId]) {
    return restoreShowDesktopById(state, desktopId);
  }

  const visibleWindows = state.windows.filter(
    (window) => window.desktopId === desktopId && window.state !== "minimized",
  );

  if (visibleWindows.length === 0) {
    return state;
  }

  const activeWindow = getActiveWindow(state.windows, desktopId);

  return {
    ...state,
    windows: state.windows.map((window) => ({
      ...window,
      isActive: window.desktopId === desktopId ? false : window.isActive,
    })),
    showDesktopSessionByDesktop: {
      ...state.showDesktopSessionByDesktop,
      [desktopId]: {
        windowIds: visibleWindows.map((window) => window.id),
        previouslyActiveWindowId: activeWindow?.id ?? null,
      },
    },
  };
};

const moveWindowToDesktopById = (
  state: WindowManagerState,
  id: string,
  targetDesktopId: DesktopId,
): WindowManagerState => {
  if (targetDesktopId > (state.desktopCount ?? DEFAULT_DESKTOP_COUNT)) {
    return state;
  }

  const target = state.windows.find((window) => window.id === id);

  if (!target || target.desktopId === targetDesktopId) {
    return state;
  }

  const sourceDesktopId = target.desktopId;
  const sourceFallbackWindow =
    target.isActive || state.lastActiveWindowIdByDesktop[sourceDesktopId] === id
      ? getTopVisibleWindow(state.windows, sourceDesktopId, id)
      : undefined;
  const sourceLastActive =
    target.isActive || state.lastActiveWindowIdByDesktop[sourceDesktopId] === id
      ? sourceFallbackWindow?.id ?? null
      : state.lastActiveWindowIdByDesktop[sourceDesktopId];
  const targetHasShowDesktopSession = state.showDesktopSessionByDesktop[targetDesktopId] !== null;
  const targetLastActive =
    target.state !== "minimized" && !targetHasShowDesktopSession
      ? id
      : state.lastActiveWindowIdByDesktop[targetDesktopId];
  const sessionsWithoutSourceWindow = removeWindowFromShowDesktopSession(
    state.showDesktopSessionByDesktop,
    sourceDesktopId,
    id,
  );
  const showDesktopSessionByDesktop =
    target.state !== "minimized" && targetHasShowDesktopSession
      ? addWindowToShowDesktopSession(sessionsWithoutSourceWindow, targetDesktopId, id)
      : sessionsWithoutSourceWindow;

  return {
    ...state,
    windows: state.windows.map((window) => {
      if (window.id === id) {
        return {
          ...window,
          desktopId: targetDesktopId,
          isActive: false,
        };
      }

      if (sourceDesktopId === state.currentDesktopId && target.isActive) {
        return {
          ...window,
          isActive: sourceFallbackWindow ? window.id === sourceFallbackWindow.id : false,
        };
      }

      return window;
    }),
    lastActiveWindowIdByDesktop: {
      ...state.lastActiveWindowIdByDesktop,
      [sourceDesktopId]: sourceLastActive,
      [targetDesktopId]: targetLastActive,
    },
    showDesktopSessionByDesktop,
  };
};

export function createWindowManagerState(
  windows: readonly DesktopWindow[],
  workArea: WorkArea,
  currentDesktopId: DesktopId = DEFAULT_DESKTOP_ID,
  requestedDesktopCount = DEFAULT_DESKTOP_COUNT,
  layoutMode: WindowLayoutMode = "desktop",
): WindowManagerState {
  const desktopCount = Number.isInteger(requestedDesktopCount) && requestedDesktopCount >= 1
    ? normalizeDesktopCount(requestedDesktopCount)
    : DEFAULT_DESKTOP_COUNT;
  const resolvedCurrentDesktopId = Math.min(Math.max(currentDesktopId, DEFAULT_DESKTOP_ID), desktopCount);
  const topZIndex = getTopZIndex(windows);
  const activeWindow = windows.find(
    (window) => window.isActive && Math.min(window.desktopId, desktopCount) === resolvedCurrentDesktopId && window.state !== "minimized",
  );
  const lastActiveWindowIdByDesktop = createEmptyLastActiveWindowRecord(desktopCount);
  lastActiveWindowIdByDesktop[resolvedCurrentDesktopId] = activeWindow?.id ?? null;
  const initialFocusRequestId = activeWindow ? 1 : null;

  return {
    windows: withDisambiguatedTitles(windows.map((window) => normalizeWindowForMode({
      ...window,
      desktopId: Math.min(Math.max(window.desktopId, DEFAULT_DESKTOP_ID), desktopCount),
      isActive: activeWindow ? window.id === activeWindow.id && Math.min(window.desktopId, desktopCount) === resolvedCurrentDesktopId : false,
      ...(initialFocusRequestId !== null && window.id === activeWindow?.id ? { focusRequestId: initialFocusRequestId } : {}),
    }, layoutMode, workArea))),
    currentDesktopId: resolvedCurrentDesktopId,
    desktopCount,
    lastActiveWindowIdByDesktop,
    showDesktopSessionByDesktop: createEmptyShowDesktopSessionRecord(desktopCount),
    launcherMetadataByWindowId: {},
    nextZIndex: topZIndex + 1,
    nextFocusRequestId: initialFocusRequestId === null ? 1 : initialFocusRequestId + 1,
    workArea,
    layoutMode,
  };
}

export function windowReducer(state: WindowManagerState, action: WindowManagerAction): WindowManagerState {
  switch (action.type) {
    case "activateWindow": {
      return activateWindowById(state, action.id);
    }

    case "moveWindow": {
      const target = state.windows.find((window) => window.id === action.id);

      if (!target || target.state !== "normal" || target.desktopId !== state.currentDesktopId) {
        return state;
      }

      if (state.layoutMode === "mobile") {
        return state;
      }

      const bounds = moveWindowBounds(
        target.bounds,
        action.x,
        action.y,
        action.screenArea ?? getScreenAreaForWorkArea(state.workArea),
        state.workArea,
      );

      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.id
            ? setCurrentNormalProfile(window, state.layoutMode, bounds)
            : window,
        ),
      };
    }

    case "resizeWindow": {
      const target = state.windows.find((window) => window.id === action.id);

      if (!target || target.state !== "normal" || !target.isResizable || target.desktopId !== state.currentDesktopId) {
        return state;
      }

      if (state.layoutMode === "mobile") {
        return state;
      }

      const bounds = action.bounds;

      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.id
            ? setCurrentNormalProfile(window, state.layoutMode, bounds)
            : window,
        ),
      };
    }

    case "fitWindowToContent": {
      const target = state.windows.find((window) => window.id === action.id);

      if (!target || target.state !== "normal" || target.desktopId !== state.currentDesktopId) {
        return state;
      }

      const bounds = state.layoutMode === "mobile"
        ? clampWindowToMobileSafeRect(
          action.bounds,
          state.workArea,
          target.minimumWidth,
          target.minimumHeight,
        )
        : action.bounds;

      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.id
            ? state.layoutMode === "mobile"
              ? {
                ...setCurrentNormalProfile(window, state.layoutMode, bounds),
                ...(getMobileWindowPresentationPolicy(window.appId) === "enforced-maximized"
                  ? { bounds: getMaximizedBounds(state.workArea) }
                  : {}),
              }
              : setCurrentNormalProfile(window, state.layoutMode, bounds)
            : window,
        ),
      };
    }

    case "minimizeWindow": {
      return minimizeWindowById(state, action.id);
    }

    case "restoreWindow": {
      return restoreWindowById(state, action.id);
    }

    case "maximizeWindow": {
      return maximizeWindowById(state, action.id);
    }

    case "restoreMaximizedWindow": {
      return restoreMaximizedWindowById(state, action.id);
    }

    case "toggleMaximizeWindow": {
      const target = state.windows.find((window) => window.id === action.id);

      if (!target || !isWindowMaximizable(target)) {
        return state;
      }

      if (state.layoutMode === "mobile" && target.state !== "minimized") {
        return state;
      }

      if (target.state === "maximized") {
        return restoreMaximizedWindowById(state, action.id);
      }

      return maximizeWindowById(state, action.id);
    }

    case "closeWindow": {
      return closeWindowById(state, action.id);
    }

    case "toggleTaskbarWindow": {
      const target = state.windows.find((window) => window.id === action.id);

      if (!target) {
        return state;
      }

      if (target.state === "minimized") {
        return restoreWindowById(state, action.id);
      }

      if (target.isActive && isWindowMinimizable(target)) {
        return minimizeWindowById(state, action.id);
      }

      return activateWindowById(state, action.id);
    }

    case "openWindow": {
      if (hasWindow(state.windows, action.window.id)) {
        return state;
      }
      const desktopId = Math.min(
        Math.max(action.window.desktopId, DEFAULT_DESKTOP_ID),
        state.desktopCount ?? DEFAULT_DESKTOP_COUNT,
      );
      const stateAfterShowDesktop = clearShowDesktopSession(state, desktopId);
      const focusRequestId = getNextFocusRequestId(state);
      const isMobileNormalWindow = state.layoutMode === "mobile"
        && getMobileWindowPresentationPolicy(action.window.appId) === "normal";
      const openedNormalBounds = state.layoutMode === "mobile"
        ? isMobileNormalWindow
          ? fitWindowToMobileWorkArea(
            action.window.bounds,
            state.workArea,
            action.window.minimumWidth,
            action.window.minimumHeight,
          )
          : clampWindowToMobileSafeRect(
            action.window.bounds,
            state.workArea,
            action.window.minimumWidth,
            action.window.minimumHeight,
          )
        : clampWindowBounds(action.window.bounds, state.workArea);
      const openedBounds = state.layoutMode === "mobile" && !isMobileNormalWindow
        ? getMaximizedBounds(state.workArea)
        : openedNormalBounds;

      const window: DesktopWindow = {
        ...action.window,
        desktopId,
        state: "normal",
        isActive: true,
        zIndex: getWindowLayeredZIndex(state.nextZIndex, action.window),
        bounds: openedBounds,
        normalBoundsByMode: setBoundsProfile(action.window.normalBoundsByMode, state.layoutMode, openedNormalBounds),
        restoreBounds: undefined,
        restoreBoundsByMode: undefined,
        stateBeforeMinimize: undefined,
        focusRequestId,
      };

      return {
        ...stateAfterShowDesktop,
        currentDesktopId: window.desktopId,
        lastActiveWindowIdByDesktop: {
          ...stateAfterShowDesktop.lastActiveWindowIdByDesktop,
          [window.desktopId]: window.id,
        },
        windows: withDisambiguatedTitles([
          ...stateAfterShowDesktop.windows.map((existingWindow) => ({
            ...existingWindow,
            isActive: false,
          })),
          window,
        ]),
        nextZIndex: state.nextZIndex + 1,
        nextFocusRequestId: focusRequestId + 1,
      };
    }

    case "focusWindow": {
      return focusWindowById(state, action.id);
    }

    case "switchDesktop": {
      return isDesktopId(action.desktopId) ? switchDesktopById(state, action.desktopId) : state;
    }

    case "setDesktopCount": {
      return setDesktopCount(state, action.desktopCount);
    }

    case "toggleShowDesktop": {
      return isDesktopId(action.desktopId) ? toggleShowDesktopById(state, action.desktopId) : state;
    }

    case "moveWindowToDesktop": {
      return isDesktopId(action.desktopId) ? moveWindowToDesktopById(state, action.id, action.desktopId) : state;
    }

    case "resetSession":
      return resetWindowSession(state);

    case "setWorkArea": {
      const screenArea = action.screenArea ?? getScreenAreaForWorkArea(action.workArea);
      const nextLayoutMode = action.layoutMode ?? state.layoutMode;

      return {
        ...state,
        workArea: action.workArea,
        layoutMode: nextLayoutMode,
        windows: state.windows.map((window) =>
          reconcileWindowForWorkArea(window, state.layoutMode, nextLayoutMode, action.workArea, screenArea),
        ),
      };
    }
    case "setWindowTitle": {
      const window = state.windows.find((item) => item.id === action.id);
      if (!window || (window.baseTitle ?? window.title) === action.title) {
        return state;
      }

      return {
        ...state,
        windows: withDisambiguatedTitles(
          state.windows.map((item) => item.id === action.id ? { ...item, baseTitle: action.title, title: action.title } : item),
        ),
      };
    }

    case "setWindowLauncherMetadata": {
      if (!hasWindow(state.windows, action.id)) {
        return state;
      }

      const current = state.launcherMetadataByWindowId[action.id];
      if (
        action.metadata?.isHomeLocation === current?.isHomeLocation &&
        action.metadata?.semanticIconId === current?.semanticIconId
      ) {
        return state;
      }

      const launcherMetadataByWindowId = { ...state.launcherMetadataByWindowId };
      if (action.metadata === null) {
        delete launcherMetadataByWindowId[action.id];
      } else {
        launcherMetadataByWindowId[action.id] = action.metadata;
      }

      return { ...state, launcherMetadataByWindowId };
    }

    case "registerWindow": {
      if (hasWindow(state.windows, action.window.id)) {
        return state;
      }

      const isMobileNormalWindow = state.layoutMode === "mobile"
        && getMobileWindowPresentationPolicy(action.window.appId) === "normal";
      const registeredNormalBounds = state.layoutMode === "mobile"
        ? isMobileNormalWindow
          ? fitWindowToMobileWorkArea(
            action.window.bounds,
            state.workArea,
            action.window.minimumWidth,
            action.window.minimumHeight,
          )
          : clampWindowToMobileSafeRect(
            action.window.bounds,
            state.workArea,
            action.window.minimumWidth,
            action.window.minimumHeight,
          )
        : clampWindowBounds(action.window.bounds, state.workArea);
      const registeredBounds = state.layoutMode === "mobile"
        && action.window.state !== "minimized"
        && !isMobileNormalWindow
        ? getMaximizedBounds(state.workArea)
        : registeredNormalBounds;

      const window: DesktopWindow = {
        ...action.window,
        isActive: action.window.isActive,
        bounds: registeredBounds,
        normalBoundsByMode: setBoundsProfile(action.window.normalBoundsByMode, state.layoutMode, registeredNormalBounds),
      };

      return {
        ...state,
        windows: withDisambiguatedTitles([
          ...state.windows.map((existingWindow) => ({
            ...existingWindow,
            isActive: window.isActive && window.desktopId === state.currentDesktopId ? false : existingWindow.isActive,
          })),
          {
            ...window,
            isActive: window.isActive && window.desktopId === state.currentDesktopId,
          },
        ]),
        lastActiveWindowIdByDesktop:
          window.isActive && window.desktopId === state.currentDesktopId
            ? {
                ...state.lastActiveWindowIdByDesktop,
                [window.desktopId]: window.id,
              }
            : state.lastActiveWindowIdByDesktop,
        nextZIndex: Math.max(state.nextZIndex, getWindowZIndexSequence(window.zIndex) + 1),
      };
    }
  }
}
