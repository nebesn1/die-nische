import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { ApplicationRuntimeContext } from "./ApplicationRuntimeContext";
import { ApplicationUsageContext } from "./ApplicationUsageContext";
import { initialApplicationUsageState, recordApplicationUse } from "./applicationUsage";
import {
  applicationRuntimeReducer,
  createApplicationCloseRequest,
  createApplicationLaunchRequest,
  initialApplicationRuntimeState,
} from "./applicationRuntimeState";
import { getApplicationDefinition, isApplicationMostUsedEligible } from "./applicationRegistry";
import { reserveApplicationInstanceId } from "./applicationInstanceIds";
import {
  getApplicationCascadeKey,
  initialApplicationCascadeState,
  reconcileApplicationCascadeState,
  reserveApplicationCascadeSerial,
} from "./cascadeState";
import { getApplicationCloseBehavior } from "./closePolicy";
import { getApplicationInstancePolicy } from "./instancePolicy";
import { ApplicationLauncherContext } from "./useApplicationLauncher";
import { getLaunchResult, planApplicationLaunch, planNewApplicationInstance } from "./launchApplication";
import type { LaunchApplicationOptions, LaunchApplicationResult } from "./types";
import { getWindowZIndexSequence, type DesktopWindow } from "../window-manager/types";
import { useWindowManager } from "../window-manager/useWindowManager";

type ApplicationRuntimeProviderProps = {
  children: ReactNode;
};

export function ApplicationRuntimeProvider({ children }: ApplicationRuntimeProviderProps) {
  const {
    activateWindow,
    closeWindow,
    currentDesktopId,
    focusWindow,
    layoutMode = "desktop",
    openWindow,
    restoreWindow,
    windows,
    workArea,
  } =
    useWindowManager();
  const [runtimeState, dispatchRuntime] = useReducer(
    applicationRuntimeReducer,
    initialApplicationRuntimeState,
  );
  const [applicationUsage, dispatchApplicationUsage] = useReducer(
    (state: typeof initialApplicationUsageState, appId: string) => recordApplicationUse(state, appId),
    initialApplicationUsageState,
  );
  const nextLaunchRequestSequenceRef = useRef(initialApplicationRuntimeState.nextLaunchRequestSequence);
  const nextCloseRequestSequenceRef = useRef(initialApplicationRuntimeState.nextCloseRequestSequence);
  const nextInstanceSerialByApplicationIdRef = useRef(initialApplicationRuntimeState.nextInstanceSerialByApplicationId);
  const nextCascadeSerialByDesktopAndApplicationRef = useRef(initialApplicationCascadeState.nextSerialByDesktopAndApplication);
  const pendingCascadeWindowsRef = useRef<readonly DesktopWindow[]>([]);
  const pendingCloseRequestByWindowIdRef = useRef<Record<string, number>>({});
  const previousWindowIdsRef = useRef<readonly string[] | null>(null);

  const reconcileCascadeStateForCurrentWindows = useCallback(() => {
    const registeredWindowIds = new Set(windows.map((window) => window.id));
    const pendingCascadeWindows = pendingCascadeWindowsRef.current.filter(
      (window) => !registeredWindowIds.has(window.id),
    );
    pendingCascadeWindowsRef.current = pendingCascadeWindows;

    return reconcileApplicationCascadeState(
      { nextSerialByDesktopAndApplication: nextCascadeSerialByDesktopAndApplicationRef.current },
      [...windows, ...pendingCascadeWindows],
    );
  }, [windows]);

  useEffect(() => {
    const openWindowIds = new Set(windows.map((window) => window.id));
    const previousWindowIds = previousWindowIdsRef.current;
    previousWindowIdsRef.current = windows.map((window) => window.id);

    if (previousWindowIds !== null && previousWindowIds.some((windowId) => !openWindowIds.has(windowId))) {
      pendingCloseRequestByWindowIdRef.current = Object.fromEntries(
        Object.entries(pendingCloseRequestByWindowIdRef.current).filter(([windowId]) => openWindowIds.has(windowId)),
      );
      dispatchRuntime({
        type: "prune-window-requests",
        windowIds: windows.map((window) => window.id),
      });
    }

    const reconciledCascadeState = reconcileCascadeStateForCurrentWindows();

    if (reconciledCascadeState.nextSerialByDesktopAndApplication !== nextCascadeSerialByDesktopAndApplicationRef.current) {
      nextCascadeSerialByDesktopAndApplicationRef.current = reconciledCascadeState.nextSerialByDesktopAndApplication;
      dispatchRuntime({
        type: "reconcile-cascade-state",
        nextSerialByDesktopAndApplication: reconciledCascadeState.nextSerialByDesktopAndApplication,
      });
    }
  }, [reconcileCascadeStateForCurrentWindows, windows]);

  const requestWindowClose = useCallback((windowId: string) => {
    const desktopWindow = windows.find((window) => window.id === windowId);

    if (!desktopWindow) {
      return;
    }

    const definition = getApplicationDefinition(desktopWindow.appId);

    if (getApplicationCloseBehavior(definition) !== "application-guarded") {
      closeWindow(windowId);
      return;
    }

    if (pendingCloseRequestByWindowIdRef.current[windowId] !== undefined) {
      return;
    }

    const created = createApplicationCloseRequest({
      latestLaunchRequestByWindowId: {},
      pendingCloseRequestByWindowId: {},
      nextLaunchRequestSequence: 1,
      nextCloseRequestSequence: nextCloseRequestSequenceRef.current,
      nextInstanceSerialByApplicationId: {},
      nextCascadeSerialByDesktopAndApplication: {},
    });
    nextCloseRequestSequenceRef.current = created.state.nextCloseRequestSequence;
    pendingCloseRequestByWindowIdRef.current = {
      ...pendingCloseRequestByWindowIdRef.current,
      [windowId]: created.request.requestId,
    };
    dispatchRuntime({ type: "store-close-request", windowId, request: created.request });
  }, [closeWindow, windows]);

  const commitWindowClose = useCallback((windowId: string, requestId: number) => {
    if (pendingCloseRequestByWindowIdRef.current[windowId] !== requestId) {
      return;
    }

    const remaining = { ...pendingCloseRequestByWindowIdRef.current };
    delete remaining[windowId];
    pendingCloseRequestByWindowIdRef.current = remaining;
    dispatchRuntime({ type: "clear-close-request", windowId, requestId });
    closeWindow(windowId);
  }, [closeWindow]);

  const cancelWindowClose = useCallback((windowId: string, requestId: number) => {
    if (pendingCloseRequestByWindowIdRef.current[windowId] !== requestId) {
      return;
    }

    const remaining = { ...pendingCloseRequestByWindowIdRef.current };
    delete remaining[windowId];
    pendingCloseRequestByWindowIdRef.current = remaining;
    dispatchRuntime({ type: "clear-close-request", windowId, requestId });
  }, []);

  const resetApplicationSession = useCallback(() => {
    pendingCloseRequestByWindowIdRef.current = {};
    nextLaunchRequestSequenceRef.current = initialApplicationRuntimeState.nextLaunchRequestSequence;
    nextCloseRequestSequenceRef.current = initialApplicationRuntimeState.nextCloseRequestSequence;
    nextInstanceSerialByApplicationIdRef.current = initialApplicationRuntimeState.nextInstanceSerialByApplicationId;
    nextCascadeSerialByDesktopAndApplicationRef.current = initialApplicationCascadeState.nextSerialByDesktopAndApplication;
    pendingCascadeWindowsRef.current = [];
    dispatchRuntime({ type: "reset-session" });
  }, []);

  const performApplicationLaunch = useCallback(
    (appId: string, options: LaunchApplicationOptions = {}, disposition: "default" | "new-instance" = "default"): LaunchApplicationResult => {
      const nextZIndex = windows.reduce((highest, window) => Math.max(highest, getWindowZIndexSequence(window.zIndex)), 0) + 1;
      const definition = getApplicationDefinition(appId);
      const allocation = definition && getApplicationInstancePolicy(definition) === "multiple" && disposition === "new-instance"
        ? reserveApplicationInstanceId(
          { nextInstanceSerialByApplicationId: nextInstanceSerialByApplicationIdRef.current },
          definition.appId,
          windows.map((window) => window.id),
        )
        : null;
      const reconciledCascadeState = reconcileCascadeStateForCurrentWindows();

      if (reconciledCascadeState.nextSerialByDesktopAndApplication !== nextCascadeSerialByDesktopAndApplicationRef.current) {
        nextCascadeSerialByDesktopAndApplicationRef.current = reconciledCascadeState.nextSerialByDesktopAndApplication;
        dispatchRuntime({
          type: "reconcile-cascade-state",
          nextSerialByDesktopAndApplication: reconciledCascadeState.nextSerialByDesktopAndApplication,
        });
      }
      const cascadeAllocation = definition && getApplicationInstancePolicy(definition) === "multiple" && disposition === "new-instance"
        ? reserveApplicationCascadeSerial(
          reconciledCascadeState,
          currentDesktopId,
          definition.appId,
        )
        : null;

      if (allocation) {
        nextInstanceSerialByApplicationIdRef.current = allocation.state.nextInstanceSerialByApplicationId;
        dispatchRuntime({
          type: "reserve-instance-serial",
          appId: definition!.appId,
          nextSerial: allocation.state.nextInstanceSerialByApplicationId[definition!.appId] ?? 1,
        });
      }

      if (cascadeAllocation) {
        nextCascadeSerialByDesktopAndApplicationRef.current = cascadeAllocation.state.nextSerialByDesktopAndApplication;
        dispatchRuntime({
          type: "reserve-cascade-serial",
          key: getApplicationCascadeKey(currentDesktopId, definition!.appId),
          nextSerial:
            cascadeAllocation.state.nextSerialByDesktopAndApplication[
              getApplicationCascadeKey(currentDesktopId, definition!.appId)
            ] ?? 0,
        });
      }

      const plan = disposition === "new-instance"
        ? planNewApplicationInstance(
          appId,
          windows,
          nextZIndex,
          currentDesktopId,
          workArea,
          allocation?.windowId,
          cascadeAllocation?.serial,
          layoutMode,
        )
        : planApplicationLaunch(appId, windows, nextZIndex, currentDesktopId, workArea, {
          windowId: allocation?.windowId,
          initialBounds: options.initialBounds,
          layoutMode,
        });
      const requestWindowId = plan.action === "open" ? plan.window.id : "windowId" in plan ? plan.windowId : null;
      const launchIntent = "intent" in options ? options.intent : definition?.defaultLaunchIntent;

      if (launchIntent !== undefined && requestWindowId) {
        const created = createApplicationLaunchRequest(
          {
            latestLaunchRequestByWindowId: {},
            pendingCloseRequestByWindowId: {},
            nextLaunchRequestSequence: nextLaunchRequestSequenceRef.current,
            nextCloseRequestSequence: nextCloseRequestSequenceRef.current,
            nextInstanceSerialByApplicationId: {},
            nextCascadeSerialByDesktopAndApplication: {},
          },
          launchIntent,
        );
        nextLaunchRequestSequenceRef.current = created.state.nextLaunchRequestSequence;
        dispatchRuntime({
          type: "store-launch-request",
          windowId: requestWindowId,
          request: created.request,
        });
      }

      if (plan.action === "open") {
        if (cascadeAllocation) {
          pendingCascadeWindowsRef.current = [...pendingCascadeWindowsRef.current, plan.window];
        }
        openWindow(plan.window);
      } else if (plan.action === "restore") {
        restoreWindow(plan.windowId);
      } else if (plan.action === "activate") {
        activateWindow(plan.windowId);
      } else if (plan.action === "focus") {
        focusWindow(plan.windowId);
      }

      const result = getLaunchResult(plan);

      if (options.origin === "user" && isApplicationMostUsedEligible(appId) && result !== "unknown-application") {
        dispatchApplicationUsage(appId);
      }

      return result;
    },
    [
      activateWindow,
      currentDesktopId,
      focusWindow,
      openWindow,
      reconcileCascadeStateForCurrentWindows,
      restoreWindow,
      layoutMode,
      windows,
      workArea,
    ],
  );

  const launchApplication = useCallback(
    (appId: string, options: LaunchApplicationOptions = {}): LaunchApplicationResult =>
      performApplicationLaunch(appId, options),
    [performApplicationLaunch],
  );

  const launchNewApplicationInstance = useCallback(
    (appId: string, options: LaunchApplicationOptions = {}): LaunchApplicationResult =>
      performApplicationLaunch(appId, options, "new-instance"),
    [performApplicationLaunch],
  );

  const launchUserApplication = useCallback(
    (appId: string, options: LaunchApplicationOptions = {}): LaunchApplicationResult =>
      performApplicationLaunch(appId, { ...options, origin: "user" }),
    [performApplicationLaunch],
  );

  const launchNewUserApplicationInstance = useCallback(
    (appId: string, options: LaunchApplicationOptions = {}): LaunchApplicationResult =>
      performApplicationLaunch(appId, { ...options, origin: "user" }, "new-instance"),
    [performApplicationLaunch],
  );

  const launcherValue = useMemo(
    () => ({
      launchApplication,
      launchNewApplicationInstance,
      launchUserApplication,
      launchNewUserApplicationInstance,
    }),
    [launchApplication, launchNewApplicationInstance, launchNewUserApplicationInstance, launchUserApplication],
  );
  const runtimeValue = useMemo(
    () => ({
      getLaunchRequestForWindow: (windowId: string) => runtimeState.latestLaunchRequestByWindowId[windowId] ?? null,
      getCloseRequestForWindow: (windowId: string) => runtimeState.pendingCloseRequestByWindowId[windowId] ?? null,
      requestWindowClose,
      commitWindowClose,
      cancelWindowClose,
      resetApplicationSession,
    }),
    [
      cancelWindowClose,
      commitWindowClose,
      requestWindowClose,
      runtimeState.latestLaunchRequestByWindowId,
      runtimeState.pendingCloseRequestByWindowId,
      resetApplicationSession,
    ],
  );

  return (
    <ApplicationRuntimeContext.Provider value={runtimeValue}>
      <ApplicationUsageContext.Provider value={applicationUsage}>
        <ApplicationLauncherContext.Provider value={launcherValue}>{children}</ApplicationLauncherContext.Provider>
      </ApplicationUsageContext.Provider>
    </ApplicationRuntimeContext.Provider>
  );
}
