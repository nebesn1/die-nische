import { getApplicationDefinition } from "./applicationRegistry";
import { getApplicationWindowId, getNextApplicationInstanceSerial } from "./applicationInstanceIds";
import { createApplicationWindow } from "./createApplicationWindow";
import { getCascadedApplicationBounds } from "./cascadePlacement";
import { resolveApplicationInitialBounds } from "./resolveApplicationInitialBounds";
import { getApplicationInstancePolicy } from "./instancePolicy";
import type { ApplicationDefinition, LaunchApplicationResult } from "./types";
import type { DesktopId, DesktopWindow, WindowLayoutMode, WorkArea } from "../window-manager/types";
import { windowReducer, type WindowManagerState } from "../window-manager/windowReducer";

export type LaunchApplicationPlan =
  | { result: "opened"; action: "open"; window: DesktopWindow }
  | { result: "activated"; action: "activate"; windowId: string }
  | { result: "restored"; action: "restore"; windowId: string }
  | {
      result: "switched-desktop-and-activated" | "switched-desktop-and-restored";
      action: "focus";
      windowId: string;
    }
  | { result: "already-active"; action: "activate"; windowId: string }
  | { result: "unknown-application"; action: "none" };

export type ApplicationLaunchDisposition = "default" | "new-instance";

export interface PlanApplicationLaunchOptions {
  readonly disposition?: ApplicationLaunchDisposition;
  readonly windowId?: string;
  /** Runtime-owned visual placement sequence for a new multiple instance. */
  readonly cascadeSerial?: number;
  /** Launcher-specific first-open bounds, applied only when creating a window. */
  readonly initialBounds?: DesktopWindow["bounds"];
  readonly layoutMode?: WindowLayoutMode;
}

const getTopVisibleZIndex = (windows: readonly DesktopWindow[], desktopId: DesktopId): number => {
  return windows
    .filter((window) => window.desktopId === desktopId && window.state !== "minimized")
    .reduce((highest, window) => Math.max(highest, window.zIndex), 0);
};

export function planApplicationLaunch(
  appId: string,
  windows: readonly DesktopWindow[],
  nextZIndex: number,
  currentDesktopId: DesktopId,
  workArea?: WorkArea,
  options?: PlanApplicationLaunchOptions,
): LaunchApplicationPlan {
  const definition = getApplicationDefinition(appId);

  if (!definition) {
    return { result: "unknown-application", action: "none" };
  }

  return planApplicationLaunchForDefinition(definition, windows, nextZIndex, currentDesktopId, workArea, options);
}

export function planApplicationLaunchForDefinition(
  definition: ApplicationDefinition,
  windows: readonly DesktopWindow[],
  nextZIndex: number,
  currentDesktopId: DesktopId,
  workArea?: WorkArea,
  options: PlanApplicationLaunchOptions = {},
): LaunchApplicationPlan {
  const instancePolicy = getApplicationInstancePolicy(definition);
  const requiresNewWindow = instancePolicy === "multiple" && options.disposition === "new-instance";

  const existingWindow = !requiresNewWindow
    ? windows.find((window) => window.appId === definition.appId)
    : undefined;

  if (!existingWindow) {
    const windowId = options.windowId ?? (requiresNewWindow
      ? getApplicationWindowId(
        definition.appId,
        getNextApplicationInstanceSerial(definition.appId, windows.map((window) => window.id)),
      )
      : undefined);

    const cascadedInitialBounds = requiresNewWindow && workArea
      ? getCascadedApplicationBounds(
        resolveApplicationInitialBounds(definition, workArea, options.layoutMode),
        options.cascadeSerial ?? 0,
        workArea,
        options?.layoutMode,
      )
      : undefined;

    return {
      result: "opened",
      action: "open",
      window: createApplicationWindow(definition, {
        zIndex: nextZIndex,
        isActive: true,
        desktopId: currentDesktopId,
        workArea,
        windowId,
        initialBounds: options.initialBounds ?? cascadedInitialBounds,
        layoutMode: options.layoutMode,
      }),
    };
  }

  if (existingWindow.desktopId !== currentDesktopId) {
    return {
      result:
        existingWindow.state === "minimized"
          ? "switched-desktop-and-restored"
          : "switched-desktop-and-activated",
      action: "focus",
      windowId: existingWindow.id,
    };
  }

  if (existingWindow.state === "minimized") {
    return {
      result: "restored",
      action: "restore",
      windowId: existingWindow.id,
    };
  }

  if (existingWindow.isActive && existingWindow.zIndex === getTopVisibleZIndex(windows, currentDesktopId)) {
    return {
      result: "already-active",
      action: "activate",
      windowId: existingWindow.id,
    };
  }

  return {
    result: "activated",
    action: "activate",
    windowId: existingWindow.id,
  };
}

export function planNewApplicationInstance(
  appId: string,
  windows: readonly DesktopWindow[],
  nextZIndex: number,
  currentDesktopId: DesktopId,
  workArea?: WorkArea,
  windowId?: string,
  cascadeSerial?: number,
  layoutMode?: WindowLayoutMode,
): LaunchApplicationPlan {
  return planApplicationLaunch(appId, windows, nextZIndex, currentDesktopId, workArea, {
    disposition: "new-instance",
    windowId,
    cascadeSerial,
    layoutMode,
  });
}

export function getLaunchResult(plan: LaunchApplicationPlan): LaunchApplicationResult {
  return plan.result;
}

export function launchApplicationInState(
  state: WindowManagerState,
  appId: string,
): { state: WindowManagerState; result: LaunchApplicationResult } {
  const plan = planApplicationLaunch(
    appId,
    state.windows,
    state.nextZIndex,
    state.currentDesktopId,
    state.workArea,
  );

  if (plan.action === "open") {
    return {
      state: windowReducer(state, { type: "openWindow", window: plan.window }),
      result: plan.result,
    };
  }

  if (plan.action === "restore") {
    return {
      state: windowReducer(state, { type: "restoreWindow", id: plan.windowId }),
      result: plan.result,
    };
  }

  if (plan.action === "activate") {
    return {
      state: windowReducer(state, { type: "activateWindow", id: plan.windowId }),
      result: plan.result,
    };
  }

  if (plan.action === "focus") {
    return {
      state: windowReducer(state, { type: "focusWindow", id: plan.windowId }),
      result: plan.result,
    };
  }

  return {
    state,
    result: plan.result,
  };
}
