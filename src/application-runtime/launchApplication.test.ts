import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "./applicationRegistry";
import {
  getAdaptiveCascadeCapacity,
  getCascadedApplicationBounds,
} from "./cascadePlacement";
import {
  initialApplicationCascadeState,
  reconcileApplicationCascadeState,
  reserveApplicationCascadeSerial,
} from "./cascadeState";
import { createApplicationWindow } from "./createApplicationWindow";
import {
  launchApplicationInState,
  planApplicationLaunchForDefinition,
  planNewApplicationInstance,
} from "./launchApplication";
import { resolveApplicationInitialBounds } from "./resolveApplicationInitialBounds";
import type { ApplicationDefinition } from "./types";
import {
  createEmptyShowDesktopSessionRecord,
  createWindowManagerState,
  windowReducer,
  type WindowManagerState,
} from "../window-manager/windowReducer";
import type { DesktopWindow, WorkArea } from "../window-manager/types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};

const getRequiredDefinition = (appId: string): ApplicationDefinition => {
  const definition = getApplicationDefinition(appId);

  if (!definition) {
    throw new Error(`${appId} definition is required for tests`);
  }

  return definition;
};

const createExistingWindowFixture = (): readonly DesktopWindow[] => [
  createApplicationWindow(getRequiredDefinition("about-kde"), { zIndex: 20, isActive: false, workArea }),
  createApplicationWindow(getRequiredDefinition("konqueror"), { zIndex: 30, isActive: true, workArea }),
];

const makeState = (windows: readonly DesktopWindow[] = createExistingWindowFixture()) =>
  createWindowManagerState(windows, workArea);

const activeWindows = (windows: readonly DesktopWindow[]) => windows.filter((window) => window.isActive);

const multipleFixtureDefinition: ApplicationDefinition = {
  appId: "test-multiple",
  name: "Test multiple",
  defaultTitle: "Test multiple",
  iconId: "konqueror",
  instancePolicy: "multiple",
  window: {
    bounds: { x: 40, y: 40, width: 420, height: 280 },
    minimumWidth: 240,
    minimumHeight: 160,
    isResizable: true,
  },
  render: () => null,
};

const openPlannedWindow = (state: WindowManagerState, plan: ReturnType<typeof planApplicationLaunchForDefinition>) => {
  if (plan.action !== "open") {
    throw new Error("Expected a new window plan");
  }

  return windowReducer(state, { type: "openWindow", window: plan.window });
};

describe("launchApplicationInState", () => {
  it("keeps historical and project About windows independently openable", () => {
    const initial = createWindowManagerState([], workArea);
    const historicalPlan = planApplicationLaunchForDefinition(
      getRequiredDefinition("about-kde"),
      initial.windows,
      initial.nextZIndex,
      1,
      workArea,
    );
    const withHistorical = openPlannedWindow(initial, historicalPlan);
    const projectPlan = planApplicationLaunchForDefinition(
      getRequiredDefinition("about-die-nische"),
      withHistorical.windows,
      withHistorical.nextZIndex,
      1,
      workArea,
    );
    const bothOpen = openPlannedWindow(withHistorical, projectPlan);

    expect(bothOpen.windows.map((window) => window.appId)).toEqual(["about-kde", "about-die-nische"]);
    expect(bothOpen.windows.map((window) => window.id)).toEqual(["app:about-kde", "app:about-die-nische"]);
    expect(bothOpen.windows.map((window) => window.title)).toEqual(["About KDE", "About die Nische"]);
  });

  it("uses the same centered initial-bounds resolver for every registered application", () => {
    for (const appId of ["about-kde", "about-konqueror", "about-kcontrol", "about-kde-panel", "about-kwrite", "about-konsole", "about-kcalc", "blog", "blog-archive", "blog-tags", "blog-search", "kcontrol", "configure-panel", "configure-clock", "konqueror", "kfind", "kwrite", "konsole", "kcalc"] as const) {
      const definition = getRequiredDefinition(appId);
      const plan = planApplicationLaunchForDefinition(
        definition,
        [],
        1,
        1,
        workArea,
        definition.instancePolicy === "multiple"
          ? { disposition: "new-instance", windowId: `app:${appId}`, cascadeSerial: 0 }
          : undefined,
      );

      if (plan.action !== "open") {
        throw new Error(`Expected ${appId} to open`);
      }

      expect(plan.window.bounds).toEqual(resolveApplicationInitialBounds(definition, workArea));
    }
  });

  it("keeps a mobile multiple-instance launch inside the logical safe rect", () => {
    const mobileWorkArea: WorkArea = { x: 0, y: 0, width: 278, height: 556, titleBarHeight: 22 };
    const plan = planNewApplicationInstance(
      "konsole",
      [],
      1,
      1,
      mobileWorkArea,
      "app:konsole",
      0,
      "mobile",
    );

    if (plan.action !== "open") {
      throw new Error("Expected a mobile Konsole window plan");
    }

    expect(plan.window.bounds.x).toBeGreaterThanOrEqual(4);
    expect(plan.window.bounds.y).toBeGreaterThanOrEqual(4);
    expect(plan.window.bounds.x + plan.window.bounds.width).toBeLessThanOrEqual(274);
    expect(plan.window.bounds.y + plan.window.bounds.height).toBeLessThanOrEqual(552);
  });

  it("opens an unopened application", () => {
    const state = createWindowManagerState([], workArea);
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.result).toBe("opened");
    expect(launched.state.windows.map((window) => window.appId)).toEqual(["konqueror"]);
  });

  it("opens Konsole as a registered multiple-instance application", () => {
    const state = createWindowManagerState([], workArea);
    const launched = launchApplicationInState(state, "konsole");
    const konsole = launched.state.windows.find((window) => window.appId === "konsole");

    expect(launched.result).toBe("opened");
    expect(launched.state.windows.filter((window) => window.appId === "konsole")).toHaveLength(1);
    expect(konsole?.title).toBe("Konsole");
    expect(konsole?.minimumWidth).toBe(420);
    expect(konsole?.minimumHeight).toBe(260);
  });

  it("opens KCalc as a registered multiple-instance application with calculator bounds", () => {
    const launched = launchApplicationInState(createWindowManagerState([], workArea), "kcalc");
    const kcalc = launched.state.windows.find((window) => window.appId === "kcalc");

    expect(launched.result).toBe("opened");
    expect(launched.state.windows.filter((window) => window.appId === "kcalc")).toHaveLength(1);
    expect(kcalc).toMatchObject({
      title: "KCalc",
      minimumWidth: 273,
      minimumHeight: 282,
      isResizable: false,
      isMaximizable: false,
    });
  });

  it("opens KWrite as a registered multiple-instance application with editor bounds", () => {
    const launched = launchApplicationInState(createWindowManagerState([], workArea), "kwrite");
    const kwrite = launched.state.windows.find((window) => window.appId === "kwrite");

    expect(launched.result).toBe("opened");
    expect(launched.state.windows.filter((window) => window.appId === "kwrite")).toHaveLength(1);
    expect(kwrite).toMatchObject({ title: "Untitled - KWrite", minimumWidth: 420, minimumHeight: 300 });
  });

  it("opens KFind as a registered multiple-instance application with search bounds", () => {
    const launched = launchApplicationInState(createWindowManagerState([], workArea), "kfind");
    const kfind = launched.state.windows.find((window) => window.appId === "kfind");

    expect(launched.result).toBe("opened");
    expect(launched.state.windows.filter((window) => window.appId === "kfind")).toHaveLength(1);
    expect(kfind).toMatchObject({ title: "Find Files/Folders", minimumWidth: 620, minimumHeight: 420 });
  });

  it("opens an unopened application on the current desktop", () => {
    const state = createWindowManagerState([], workArea, 3);
    const launched = launchApplicationInState(state, "about-kde");

    expect(launched.result).toBe("opened");
    expect(launched.state.currentDesktopId).toBe(3);
    expect(launched.state.windows[0]?.desktopId).toBe(3);
    expect(launched.state.lastActiveWindowIdByDesktop[3]).toBe("app:about-kde");
  });

  it("makes a new window the only active window", () => {
    const state = createWindowManagerState([createExistingWindowFixture()[0]], workArea);
    const launched = launchApplicationInState(state, "konqueror");

    expect(activeWindows(launched.state.windows)).toHaveLength(1);
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.isActive).toBe(true);
  });

  it("opens a new window at the highest z-index", () => {
    const state = createWindowManagerState([createExistingWindowFixture()[0]], workArea);
    const launched = launchApplicationInState(state, "konqueror");
    const konqueror = launched.state.windows.find((window) => window.appId === "konqueror");
    const about = launched.state.windows.find((window) => window.appId === "about-kde");

    expect(konqueror?.zIndex).toBeGreaterThan(about?.zIndex ?? 0);
  });

  it("does not create duplicate singleton windows", () => {
    const state = makeState();
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.state.windows.filter((window) => window.appId === "konqueror")).toHaveLength(1);
  });

  it("keeps every About window independent while preserving each singleton restore boundary", () => {
    const appIds = ["about-kde", "about-konqueror", "about-kcontrol", "about-kde-panel", "about-kwrite", "about-konsole", "about-kcalc"] as const;
    const opened = appIds.reduce(
      (state, appId) => launchApplicationInState(state, appId).state,
      createWindowManagerState([], workArea),
    );
    const duplicateKde = launchApplicationInState(opened, "about-kde");
    const minimizedKonsole = windowReducer(duplicateKde.state, {
      type: "minimizeWindow",
      id: "app:about-konsole",
    });
    const restoredKonsole = launchApplicationInState(minimizedKonsole, "about-konsole");

    expect(opened.windows.map((window) => window.appId)).toEqual(appIds);
    expect(opened.windows.map((window) => window.title)).toEqual(["About KDE", "About Konqueror", "About KDE Control Center", "About KDE Panel", "About KWrite", "About Konsole", "About KCalc"]);
    expect(duplicateKde.result).toBe("activated");
    expect(duplicateKde.state.windows.filter((window) => window.appId === "about-kde")).toHaveLength(1);
    expect(restoredKonsole.result).toBe("restored");
    expect(restoredKonsole.state.windows.filter((window) => window.appId === "about-konsole")).toHaveLength(1);
    expect(restoredKonsole.state.windows.find((window) => window.appId === "about-kde")?.state).toBe("normal");

    const closedKWrite = windowReducer(restoredKonsole.state, { type: "closeWindow", id: "app:about-kwrite" });
    expect(closedKWrite.windows.map((window) => window.appId)).not.toContain("about-kwrite");
    expect(closedKWrite.windows.map((window) => window.appId)).toContain("about-kde");
    expect(closedKWrite.windows.map((window) => window.appId)).toContain("about-kcalc");
  });

  it("focuses the Control Center About singleton and closes it without closing Control Center", () => {
    const controlCenter = launchApplicationInState(createWindowManagerState([], workArea), "kcontrol");
    const about = launchApplicationInState(controlCenter.state, "about-kcontrol");
    const repeated = launchApplicationInState(about.state, "about-kcontrol");
    const closed = windowReducer(repeated.state, { type: "closeWindow", id: "app:about-kcontrol" });

    expect(about.result).toBe("opened");
    expect(repeated.result).toBe("already-active");
    expect(repeated.state.windows.filter((window) => window.appId === "about-kcontrol")).toHaveLength(1);
    expect(closed.windows.map((window) => window.appId)).toContain("kcontrol");
    expect(closed.windows.map((window) => window.appId)).not.toContain("about-kcontrol");
  });

  it("keeps ordinary Konsole launches focused on the existing multiple instance across desktops", () => {
    const first = launchApplicationInState(createWindowManagerState([], workArea, 2), "konsole");
    const minimized = windowReducer(first.state, { type: "minimizeWindow", id: "app:konsole" });
    const restored = launchApplicationInState(minimized, "konsole");
    const onDesktopOne = windowReducer(restored.state, { type: "switchDesktop", desktopId: 1 });
    const focused = launchApplicationInState(onDesktopOne, "konsole");

    expect(restored.result).toBe("restored");
    expect(focused.result).toBe("switched-desktop-and-activated");
    expect(focused.state.currentDesktopId).toBe(2);
    expect(focused.state.windows.filter((window) => window.appId === "konsole")).toHaveLength(1);
  });

  it("keeps ordinary KCalc launches focused on the existing multiple instance across desktops", () => {
    const first = launchApplicationInState(createWindowManagerState([], workArea, 2), "kcalc");
    const minimized = windowReducer(first.state, { type: "minimizeWindow", id: "app:kcalc" });
    const restored = launchApplicationInState(minimized, "kcalc");
    const otherDesktop = windowReducer(restored.state, { type: "switchDesktop", desktopId: 1 });
    const focused = launchApplicationInState(otherDesktop, "kcalc");

    expect(restored.result).toBe("restored");
    expect(focused.result).toBe("switched-desktop-and-activated");
    expect(focused.state.currentDesktopId).toBe(2);
    expect(focused.state.windows.filter((window) => window.appId === "kcalc")).toHaveLength(1);
  });

  it("creates a fresh KCalc window after close", () => {
    const opened = launchApplicationInState(createWindowManagerState([], workArea), "kcalc");
    const closed = windowReducer(opened.state, { type: "closeWindow", id: "app:kcalc" });
    const reopened = launchApplicationInState(closed, "kcalc");

    expect(reopened.result).toBe("opened");
    expect(reopened.state.windows.filter((window) => window.appId === "kcalc")).toHaveLength(1);
    expect(reopened.state.windows.find((window) => window.appId === "kcalc")?.id).toBe("app:kcalc");
  });

  it("opens production KCalc instances only through the explicit new-instance disposition", () => {
    const definition = getApplicationDefinition("kcalc");
    if (!definition) throw new Error("KCalc definition is required");

    const firstPlan = planNewApplicationInstance("kcalc", [], 1, 1, workArea, "app:kcalc", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const secondPlan = planNewApplicationInstance(
      "kcalc",
      firstState.windows,
      firstState.nextZIndex,
      1,
      workArea,
      "app:kcalc::2",
      1,
    );
    const secondState = openPlannedWindow(firstState, secondPlan);
    const thirdPlan = planNewApplicationInstance(
      "kcalc",
      secondState.windows,
      secondState.nextZIndex,
      1,
      workArea,
      "app:kcalc::3",
      2,
    );
    const thirdState = openPlannedWindow(secondState, thirdPlan);
    const defaultPlan = planApplicationLaunchForDefinition(
      definition,
      thirdState.windows,
      thirdState.nextZIndex,
      1,
      workArea,
    );

    expect(thirdState.windows.map((window) => window.id)).toEqual(["app:kcalc", "app:kcalc::2", "app:kcalc::3"]);
    expect(thirdState.windows.map((window) => window.title)).toEqual(["KCalc", "KCalc<2>", "KCalc<3>"]);
    expect(thirdState.windows.map((window) => window.baseTitle)).toEqual(["KCalc", "KCalc", "KCalc"]);
    const initialBounds = resolveApplicationInitialBounds(definition, workArea);
    const capacity = getAdaptiveCascadeCapacity(initialBounds, workArea);
    expect(thirdState.windows.map((window) => window.bounds)).toEqual([
      getCascadedApplicationBounds(initialBounds, 0, workArea),
      getCascadedApplicationBounds(initialBounds, 1, workArea),
      getCascadedApplicationBounds(initialBounds, 2, workArea),
    ]);
    expect(capacity).toBeGreaterThanOrEqual(1);
    expect(defaultPlan).toMatchObject({ action: "activate", windowId: "app:kcalc" });

    const closedMiddle = windowReducer(thirdState, { type: "closeWindow", id: "app:kcalc::2" });
    expect(closedMiddle.windows.map((window) => window.title)).toEqual(["KCalc", "KCalc<2>"]);
  });

  it("creates an explicit KCalc instance on the current desktop while captions remain global", () => {
    const firstPlan = planNewApplicationInstance("kcalc", [], 1, 1, workArea, "app:kcalc", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const desktopTwo = windowReducer(firstState, { type: "switchDesktop", desktopId: 2 });
    const secondPlan = planNewApplicationInstance(
      "kcalc",
      desktopTwo.windows,
      desktopTwo.nextZIndex,
      desktopTwo.currentDesktopId,
      workArea,
      "app:kcalc::2",
      0,
    );
    const state = openPlannedWindow(desktopTwo, secondPlan);

    expect(state.windows.map((window) => window.desktopId)).toEqual([1, 2]);
    expect(state.windows.map((window) => window.title)).toEqual(["KCalc", "KCalc<2>"]);
  });

  it("keeps ordinary KWrite launches focused on the existing multiple instance across desktops", () => {
    const first = launchApplicationInState(createWindowManagerState([], workArea, 2), "kwrite");
    const minimized = windowReducer(first.state, { type: "minimizeWindow", id: "app:kwrite" });
    const restored = launchApplicationInState(minimized, "kwrite");
    const onDesktopOne = windowReducer(restored.state, { type: "switchDesktop", desktopId: 1 });
    const focused = launchApplicationInState(onDesktopOne, "kwrite");

    expect(restored.result).toBe("restored");
    expect(focused.result).toBe("switched-desktop-and-activated");
    expect(focused.state.currentDesktopId).toBe(2);
    expect(restored.state.windows.filter((window) => window.appId === "kwrite")).toHaveLength(1);
  });

  it("keeps ordinary KFind launches focused on the existing multiple instance across desktops", () => {
    const first = launchApplicationInState(createWindowManagerState([], workArea, 2), "kfind");
    const minimized = windowReducer(first.state, { type: "minimizeWindow", id: "app:kfind" });
    const restored = launchApplicationInState(minimized, "kfind");
    const onDesktopOne = windowReducer(restored.state, { type: "switchDesktop", desktopId: 1 });
    const focused = launchApplicationInState(onDesktopOne, "kfind");

    expect(restored.result).toBe("restored");
    expect(focused.result).toBe("switched-desktop-and-activated");
    expect(focused.state.windows.filter((window) => window.appId === "kfind")).toHaveLength(1);
  });

  it("switches desktop and focuses an existing Konsole through the ordinary multiple-instance planner", () => {
    const first = launchApplicationInState(createWindowManagerState([], workArea, 3), "konsole");
    const onDesktopOne = windowReducer(first.state, { type: "switchDesktop", desktopId: 1 });
    const launched = launchApplicationInState(onDesktopOne, "konsole");

    expect(launched.result).toBe("switched-desktop-and-activated");
    expect(launched.state.currentDesktopId).toBe(3);
    expect(launched.state.windows.filter((window) => window.appId === "konsole")).toHaveLength(1);
  });

  it("switches to another desktop when launching an existing singleton there", () => {
    const state = createWindowManagerState(createExistingWindowFixture(), workArea, 3);
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.result).toBe("switched-desktop-and-activated");
    expect(launched.state.currentDesktopId).toBe(1);
    expect(launched.state.windows.filter((window) => window.appId === "konqueror")).toHaveLength(1);
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.desktopId).toBe(1);
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.isActive).toBe(true);
  });

  it("activates and raises an inactive normal singleton", () => {
    const state = windowReducer(makeState(), { type: "activateWindow", id: "app:about-kde" });
    const launched = launchApplicationInState(state, "konqueror");
    const konqueror = launched.state.windows.find((window) => window.appId === "konqueror");
    const about = launched.state.windows.find((window) => window.appId === "about-kde");

    expect(launched.result).toBe("activated");
    expect(konqueror?.isActive).toBe(true);
    expect(konqueror?.zIndex).toBeGreaterThan(about?.zIndex ?? 0);
  });

  it("activates an inactive maximized singleton without changing state", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "app:konqueror" });
    const aboutActive = windowReducer(maximized, { type: "activateWindow", id: "app:about-kde" });
    const launched = launchApplicationInState(aboutActive, "konqueror");

    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.state).toBe("maximized");
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.isActive).toBe(true);
  });

  it("restores a minimized normal singleton", () => {
    const minimized = windowReducer(windowReducer(makeState(), { type: "activateWindow", id: "app:about-kde" }), {
      type: "minimizeWindow",
      id: "app:about-kde",
    });
    const launched = launchApplicationInState(minimized, "about-kde");

    expect(launched.result).toBe("restored");
    expect(launched.state.windows.find((window) => window.appId === "about-kde")?.state).toBe("normal");
  });

  it("restores a minimized maximized singleton", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "app:konqueror" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "app:konqueror" });
    const launched = launchApplicationInState(minimized, "konqueror");

    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.state).toBe("maximized");
  });

  it("restores a minimized singleton on another desktop without moving it", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "app:konqueror" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "app:konqueror" });
    const onDesktopThree = windowReducer(minimized, { type: "switchDesktop", desktopId: 3 });
    const launched = launchApplicationInState(onDesktopThree, "konqueror");
    const konqueror = launched.state.windows.find((window) => window.appId === "konqueror");

    expect(launched.result).toBe("switched-desktop-and-restored");
    expect(launched.state.currentDesktopId).toBe(1);
    expect(konqueror?.state).toBe("maximized");
    expect(konqueror?.desktopId).toBe(1);
  });

  it("does not grow z-index for an already active top singleton while issuing a focus handoff", () => {
    const state = makeState();
    const before = state.windows.find((window) => window.appId === "konqueror")?.zIndex;
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.result).toBe("already-active");
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.zIndex).toBe(before);
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.focusRequestId).toBeGreaterThan(
      state.windows.find((window) => window.appId === "konqueror")?.focusRequestId ?? 0,
    );
  });

  it("does not change state for an unknown app id", () => {
    const state = makeState();
    const launched = launchApplicationInState(state, "missing-app");

    expect(launched.result).toBe("unknown-application");
    expect(launched.state).toBe(state);
  });

  it("does not switch desktop for an unknown app id", () => {
    const state = createWindowManagerState([], workArea, 4);
    const launched = launchApplicationInState(state, "missing-app");

    expect(launched.result).toBe("unknown-application");
    expect(launched.state.currentDesktopId).toBe(4);
  });

  it("does not clear show desktop sessions for an unknown app id", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const launched = launchApplicationInState(shown, "missing-app");

    expect(launched.result).toBe("unknown-application");
    expect(launched.state.showDesktopSessionByDesktop[1]).toEqual(shown.showDesktopSessionByDesktop[1]);
  });

  it("can relaunch an app after close", () => {
    const closed = windowReducer(makeState(), { type: "closeWindow", id: "app:about-kde" });
    const launched = launchApplicationInState(closed, "about-kde");

    expect(launched.state.windows.map((window) => window.appId)).toEqual(["konqueror", "about-kde"]);
  });

  it("relaunches closed applications onto the then-current desktop", () => {
    const closed = windowReducer(makeState(), { type: "closeWindow", id: "app:about-kde" });
    const desktopThree = windowReducer(closed, { type: "switchDesktop", desktopId: 3 });
    const launched = launchApplicationInState(desktopThree, "about-kde");

    expect(launched.state.currentDesktopId).toBe(3);
    expect(launched.state.windows.find((window) => window.appId === "about-kde")?.desktopId).toBe(3);
    expect(launched.state.windows.map((window) => window.appId)).toEqual(["konqueror", "about-kde"]);
  });

  it("opens a new application by exiting the current desktop show desktop session", () => {
    const closed = windowReducer(makeState(), { type: "closeWindow", id: "app:about-kde" });
    const shown = windowReducer(closed, { type: "toggleShowDesktop", desktopId: 1 });
    const launched = launchApplicationInState(shown, "about-kde");

    expect(launched.result).toBe("opened");
    expect(launched.state.showDesktopSessionByDesktop[1]).toBeNull();
    expect(launched.state.windows.find((window) => window.appId === "about-kde")?.isActive).toBe(true);
  });

  it("activates an existing current-desktop application by exiting show desktop", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const launched = launchApplicationInState(shown, "konqueror");

    expect(launched.result).toBe("activated");
    expect(launched.state.showDesktopSessionByDesktop[1]).toBeNull();
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.isActive).toBe(true);
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.zIndex).toBe(shown.nextZIndex);
    expect(launched.state.nextZIndex).toBe(shown.nextZIndex + 1);
  });

  it("clears a target desktop show desktop session when focusing a cross-desktop singleton", () => {
    const state = {
      ...createWindowManagerState(createExistingWindowFixture(), workArea, 3),
      showDesktopSessionByDesktop: {
        ...createEmptyShowDesktopSessionRecord(),
        1: {
          windowIds: ["app:about-kde", "app:konqueror"],
          previouslyActiveWindowId: "app:konqueror",
        },
      },
    };
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.result).toBe("switched-desktop-and-activated");
    expect(launched.state.currentDesktopId).toBe(1);
    expect(launched.state.showDesktopSessionByDesktop[1]).toBeNull();
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.isActive).toBe(true);
    expect(launched.state.windows.filter((window) => window.appId === "konqueror")).toHaveLength(1);
  });

  it("clears a target desktop show desktop session when restoring a cross-desktop minimized singleton", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "app:konqueror" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "app:konqueror" });
    const desktopThree = windowReducer(minimized, { type: "switchDesktop", desktopId: 3 });
    const state = {
      ...desktopThree,
      showDesktopSessionByDesktop: {
        ...desktopThree.showDesktopSessionByDesktop,
        1: {
          windowIds: ["app:about-kde"],
          previouslyActiveWindowId: "app:about-kde",
        },
      },
    };
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.result).toBe("switched-desktop-and-restored");
    expect(launched.state.showDesktopSessionByDesktop[1]).toBeNull();
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.state).toBe("maximized");
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.isActive).toBe(true);
  });

  it("reopened windows use default bounds constrained by current work area", () => {
    const definition = getApplicationDefinition("konqueror");

    if (!definition) {
      throw new Error("Konqueror definition is required for tests");
    }

    const smallWorkArea = { ...workArea, width: 520, height: 300 };
    const closed = createWindowManagerState([], smallWorkArea);
    const launched = launchApplicationInState(closed, "konqueror");
    const window = launched.state.windows[0];
    const expectedBounds = resolveApplicationInitialBounds(definition, smallWorkArea);

    expect(window.bounds).toEqual(expectedBounds);
    expect(window.bounds.y + smallWorkArea.titleBarHeight).toBeLessThanOrEqual(smallWorkArea.height);
  });

  it("first user launch uses the initial bounds resolver without a bootstrap window", () => {
    const definition = getApplicationDefinition("konqueror");

    if (!definition) {
      throw new Error("Konqueror definition is required for tests");
    }

    const smallWorkArea = { ...workArea, height: 600 };
    const launched = launchApplicationInState(createWindowManagerState([], smallWorkArea), "konqueror");

    expect(launched.state.windows[0]?.id).toBe("app:konqueror");
    expect(launched.state.windows[0]?.bounds).toEqual(resolveApplicationInitialBounds(definition, smallWorkArea));
  });

  it("does not reset an existing inactive window to default bounds when launching", () => {
    const resizedBounds = { x: 120, y: 80, width: 620, height: 360 };
    const resized = windowReducer(makeState(), {
      type: "resizeWindow",
      id: "app:konqueror",
      bounds: resizedBounds,
    });
    const aboutActive = windowReducer(resized, { type: "activateWindow", id: "app:about-kde" });
    const launched = launchApplicationInState(aboutActive, "konqueror");

    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.bounds).toEqual(resizedBounds);
  });

  it("restores a minimized application without resetting its current bounds", () => {
    const resizedBounds = { x: 120, y: 80, width: 620, height: 360 };
    const resized = windowReducer(makeState(), {
      type: "resizeWindow",
      id: "app:konqueror",
      bounds: resizedBounds,
    });
    const minimized = windowReducer(resized, { type: "minimizeWindow", id: "app:konqueror" });
    const launched = launchApplicationInState(minimized, "konqueror");

    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.bounds).toEqual(resizedBounds);
  });

  it("does not reset a manually resized active application when launched again", () => {
    const resizedBounds = { x: 120, y: 80, width: 620, height: 360 };
    const resized = windowReducer(makeState(), {
      type: "resizeWindow",
      id: "app:konqueror",
      bounds: resizedBounds,
    });
    const launched = launchApplicationInState(resized, "konqueror");

    expect(launched.result).toBe("already-active");
    expect(launched.state.windows.find((window) => window.appId === "konqueror")?.bounds).toEqual(resizedBounds);
  });

  it("focuses a moved singleton on its new desktop without creating a duplicate", () => {
    const moved = windowReducer(makeState(), {
      type: "moveWindowToDesktop",
      id: "app:konqueror",
      desktopId: 4,
    });
    const launched = launchApplicationInState(moved, "konqueror");
    const konqueror = launched.state.windows.find((window) => window.appId === "konqueror");

    expect(launched.result).toBe("switched-desktop-and-activated");
    expect(launched.state.currentDesktopId).toBe(4);
    expect(konqueror?.desktopId).toBe(4);
    expect(konqueror?.isActive).toBe(true);
    expect(launched.state.windows.filter((window) => window.appId === "konqueror")).toHaveLength(1);
  });

  it("does not change other window bounds when launching", () => {
    const state = makeState();
    const aboutBounds = state.windows.find((window) => window.appId === "about-kde")?.bounds;
    const launched = launchApplicationInState(state, "konqueror");

    expect(launched.state.windows.find((window) => window.appId === "about-kde")?.bounds).toEqual(aboutBounds);
  });

  it("does not produce two active windows", () => {
    const states = [
      launchApplicationInState(createWindowManagerState([], workArea), "konqueror").state,
      launchApplicationInState(windowReducer(makeState(), { type: "activateWindow", id: "app:about-kde" }), "konqueror")
        .state,
      launchApplicationInState(
        windowReducer(makeState(), { type: "minimizeWindow", id: "app:konqueror" }),
        "konqueror",
      ).state,
    ];

    states.forEach((state) => {
      expect(activeWindows(state.windows)).toHaveLength(1);
    });
  });

  it("does not share default bounds through created windows", () => {
    const definition = getApplicationDefinition("about-kde");

    if (!definition) {
      throw new Error("About definition is required for tests");
    }

    const firstWindow = createApplicationWindow(definition, { zIndex: 1, isActive: true });
    firstWindow.bounds.x = 10;
    const secondWindow = createApplicationWindow(definition, { zIndex: 1, isActive: true });

    expect(secondWindow.bounds.x).toBe(280);
  });

  it("plans independent deterministic windows for an explicit multiple-instance definition", () => {
    const firstPlan = planApplicationLaunchForDefinition(
      multipleFixtureDefinition,
      [],
      1,
      1,
      workArea,
      { disposition: "new-instance", windowId: "app:test-multiple" },
    );
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const secondPlan = planApplicationLaunchForDefinition(
      multipleFixtureDefinition,
      firstState.windows,
      firstState.nextZIndex,
      1,
      workArea,
      { disposition: "new-instance", windowId: "app:test-multiple::2" },
    );
    const secondState = openPlannedWindow(firstState, secondPlan);
    const thirdPlan = planApplicationLaunchForDefinition(
      multipleFixtureDefinition,
      secondState.windows,
      secondState.nextZIndex,
      1,
      workArea,
      { disposition: "new-instance", windowId: "app:test-multiple::3" },
    );
    const thirdState = openPlannedWindow(secondState, thirdPlan);

    expect(thirdState.windows.map((window) => window.id)).toEqual([
      "app:test-multiple",
      "app:test-multiple::2",
      "app:test-multiple::3",
    ]);
    expect(thirdState.windows.map((window) => window.appId)).toEqual([
      "test-multiple",
      "test-multiple",
      "test-multiple",
    ]);
    expect(thirdState.windows[0]?.bounds).not.toBe(thirdState.windows[1]?.bounds);
    expect(thirdState.windows[2]?.desktopId).toBe(1);
    expect(thirdState.windows[2]?.isActive).toBe(true);
  });

  it("enforces singleton policy even for a new-instance plan", () => {
    const state = launchApplicationInState(makeState(), "kcontrol").state;
    const plan = planNewApplicationInstance(
      "kcontrol",
      state.windows,
      state.nextZIndex,
      state.currentDesktopId,
      state.workArea,
      "app:kcontrol::2",
    );

    expect(plan).toMatchObject({ action: "activate", windowId: "app:kcontrol" });
  });

  it("uses new-instance disposition rather than app id alone to create another multiple instance", () => {
    const first = createApplicationWindow(multipleFixtureDefinition, {
      zIndex: 20,
      isActive: false,
      windowId: "app:test-multiple",
    });
    const second = createApplicationWindow(multipleFixtureDefinition, {
      zIndex: 30,
      isActive: true,
      windowId: "app:test-multiple::2",
    });
    const defaultPlan = planApplicationLaunchForDefinition(
      multipleFixtureDefinition,
      [first, second],
      40,
      1,
      workArea,
    );
    const newInstancePlan = planApplicationLaunchForDefinition(
      multipleFixtureDefinition,
      [first, second],
      40,
      1,
      workArea,
      { disposition: "new-instance", windowId: "app:test-multiple::3" },
    );

    expect(defaultPlan).toMatchObject({ action: "activate", windowId: first.id });
    expect(newInstancePlan).toMatchObject({ action: "open", window: { id: "app:test-multiple::3" } });
  });

  it("keeps the earliest existing production instance as the ordinary Runtime target", () => {
    for (const appId of ["konqueror", "kfind", "kwrite", "konsole", "kcalc"] as const) {
      const definition = getRequiredDefinition(appId);
      const firstPlan = planNewApplicationInstance(appId, [], 1, 1, workArea, `app:${appId}`, 0);
      const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
      const secondPlan = planNewApplicationInstance(
        appId,
        firstState.windows,
        firstState.nextZIndex,
        1,
        workArea,
        `app:${appId}::2`,
        1,
      );
      const secondState = openPlannedWindow(firstState, secondPlan);
      const ordinaryPlan = planApplicationLaunchForDefinition(
        definition,
        secondState.windows,
        secondState.nextZIndex,
        1,
        workArea,
      );

      expect(ordinaryPlan).toMatchObject({ action: "activate", windowId: `app:${appId}` });
      expect(secondState.windows.filter((window) => window.appId === appId)).toHaveLength(2);
    }
  });

  it("does not consume an explicit cascade slot when ordinary launch reuses an existing instance", () => {
    const definition = getRequiredDefinition("kcalc");
    const firstAllocation = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, definition.appId);
    const firstPlan = planNewApplicationInstance(
      definition.appId,
      [],
      1,
      1,
      workArea,
      "app:kcalc",
      firstAllocation.serial,
    );
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const ordinaryPlan = planApplicationLaunchForDefinition(
      definition,
      firstState.windows,
      firstState.nextZIndex,
      1,
      workArea,
    );
    const nextAllocation = reserveApplicationCascadeSerial(
      reconcileApplicationCascadeState(firstAllocation.state, firstState.windows),
      1,
      definition.appId,
    );

    expect(ordinaryPlan).toMatchObject({ action: "activate", windowId: "app:kcalc" });
    expect(nextAllocation.serial).toBe(1);
  });

  it("opens another Konqueror only through the explicit new-instance disposition", () => {
    const state = makeState();
    const defaultPlan = planApplicationLaunchForDefinition(
      getApplicationDefinition("konqueror")!,
      state.windows,
      state.nextZIndex,
      state.currentDesktopId,
      state.workArea,
    );
    const newPlan = planNewApplicationInstance(
      "konqueror",
      state.windows,
      state.nextZIndex,
      state.currentDesktopId,
      state.workArea,
      "app:konqueror::2",
      1,
    );

    expect(defaultPlan).toMatchObject({ action: "activate", windowId: "app:konqueror" });
    expect(newPlan).toMatchObject({ action: "open", window: { id: "app:konqueror::2", appId: "konqueror" } });
    if (newPlan.action !== "open") throw new Error("Expected Konqueror new-instance plan");
    expect(newPlan.window.bounds).not.toEqual(state.windows.find((window) => window.id === "app:konqueror")?.bounds);
  });

  it("opens production KFind instances only through the explicit new-instance disposition", () => {
    const definition = getApplicationDefinition("kfind");
    if (!definition) throw new Error("KFind definition is required");

    const firstPlan = planNewApplicationInstance("kfind", [], 1, 1, workArea, "app:kfind", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const secondPlan = planNewApplicationInstance(
      "kfind",
      firstState.windows,
      firstState.nextZIndex,
      1,
      workArea,
      "app:kfind::2",
      1,
    );
    const secondState = openPlannedWindow(firstState, secondPlan);
    const thirdPlan = planNewApplicationInstance(
      "kfind",
      secondState.windows,
      secondState.nextZIndex,
      1,
      workArea,
      "app:kfind::3",
      2,
    );
    const thirdState = openPlannedWindow(secondState, thirdPlan);
    const defaultPlan = planApplicationLaunchForDefinition(
      definition,
      thirdState.windows,
      thirdState.nextZIndex,
      1,
      workArea,
    );

    expect(thirdState.windows.map((window) => window.id)).toEqual(["app:kfind", "app:kfind::2", "app:kfind::3"]);
    expect(thirdState.windows.map((window) => window.title)).toEqual([
      "Find Files/Folders",
      "Find Files/Folders<2>",
      "Find Files/Folders<3>",
    ]);
    expect(thirdState.windows.map((window) => window.baseTitle)).toEqual([
      "Find Files/Folders",
      "Find Files/Folders",
      "Find Files/Folders",
    ]);
    expect(thirdState.windows[0]?.bounds).not.toEqual(thirdState.windows[1]?.bounds);
    expect(defaultPlan).toMatchObject({ action: "activate", windowId: "app:kfind" });

    const closedMiddle = windowReducer(thirdState, { type: "closeWindow", id: "app:kfind::2" });
    expect(closedMiddle.windows.map((window) => window.title)).toEqual([
      "Find Files/Folders",
      "Find Files/Folders<2>",
    ]);
  });

  it("opens production KWrite instances only through the explicit new-instance disposition", () => {
    const definition = getApplicationDefinition("kwrite");
    if (!definition) throw new Error("KWrite definition is required");

    const firstPlan = planNewApplicationInstance("kwrite", [], 1, 1, workArea, "app:kwrite", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const secondPlan = planNewApplicationInstance(
      "kwrite",
      firstState.windows,
      firstState.nextZIndex,
      1,
      workArea,
      "app:kwrite::2",
      1,
    );
    const secondState = openPlannedWindow(firstState, secondPlan);
    const thirdPlan = planNewApplicationInstance(
      "kwrite",
      secondState.windows,
      secondState.nextZIndex,
      1,
      workArea,
      "app:kwrite::3",
      2,
    );
    const thirdState = openPlannedWindow(secondState, thirdPlan);
    const defaultPlan = planApplicationLaunchForDefinition(
      definition,
      thirdState.windows,
      thirdState.nextZIndex,
      1,
      workArea,
    );

    expect(thirdState.windows.map((window) => window.id)).toEqual(["app:kwrite", "app:kwrite::2", "app:kwrite::3"]);
    expect(thirdState.windows.map((window) => window.title)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
      "Untitled - KWrite<3>",
    ]);
    expect(thirdState.windows.map((window) => window.baseTitle)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite",
      "Untitled - KWrite",
    ]);
    const initialBounds = resolveApplicationInitialBounds(definition, workArea);
    const capacity = getAdaptiveCascadeCapacity(initialBounds, workArea);
    expect(thirdState.windows.map((window) => window.bounds)).toEqual([
      getCascadedApplicationBounds(initialBounds, 0, workArea),
      getCascadedApplicationBounds(initialBounds, 1, workArea),
      getCascadedApplicationBounds(initialBounds, 2, workArea),
    ]);
    expect(capacity).toBe(1);
    expect(defaultPlan).toMatchObject({ action: "activate", windowId: "app:kwrite" });

    const closedMiddle = windowReducer(thirdState, { type: "closeWindow", id: "app:kwrite::2" });
    expect(closedMiddle.windows.map((window) => window.title)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
    ]);
  });

  it("opens production Konsole instances only through the explicit new-instance disposition", () => {
    const definition = getApplicationDefinition("konsole");
    if (!definition) throw new Error("Konsole definition is required");

    const firstPlan = planNewApplicationInstance("konsole", [], 1, 1, workArea, "app:konsole", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const secondPlan = planNewApplicationInstance(
      "konsole",
      firstState.windows,
      firstState.nextZIndex,
      1,
      workArea,
      "app:konsole::2",
      1,
    );
    const secondState = openPlannedWindow(firstState, secondPlan);
    const thirdPlan = planNewApplicationInstance(
      "konsole",
      secondState.windows,
      secondState.nextZIndex,
      1,
      workArea,
      "app:konsole::3",
      2,
    );
    const thirdState = openPlannedWindow(secondState, thirdPlan);
    const defaultPlan = planApplicationLaunchForDefinition(
      definition,
      thirdState.windows,
      thirdState.nextZIndex,
      1,
      workArea,
    );

    expect(thirdState.windows.map((window) => window.id)).toEqual(["app:konsole", "app:konsole::2", "app:konsole::3"]);
    expect(thirdState.windows.map((window) => window.title)).toEqual(["Konsole", "Konsole<2>", "Konsole<3>"]);
    expect(thirdState.windows.map((window) => window.baseTitle)).toEqual(["Konsole", "Konsole", "Konsole"]);
    expect(thirdState.windows[0]?.bounds).not.toEqual(thirdState.windows[1]?.bounds);
    expect(defaultPlan).toMatchObject({ action: "activate", windowId: "app:konsole" });

    const closedMiddle = windowReducer(thirdState, { type: "closeWindow", id: "app:konsole::2" });
    expect(closedMiddle.windows.map((window) => window.title)).toEqual(["Konsole", "Konsole<2>"]);
  });

  it("creates an explicit Konsole instance on the current desktop while captions remain global", () => {
    const firstPlan = planNewApplicationInstance("konsole", [], 1, 1, workArea, "app:konsole", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const desktopTwo = windowReducer(firstState, { type: "switchDesktop", desktopId: 2 });
    const secondPlan = planNewApplicationInstance(
      "konsole",
      desktopTwo.windows,
      desktopTwo.nextZIndex,
      desktopTwo.currentDesktopId,
      workArea,
      "app:konsole::2",
      0,
    );
    const state = openPlannedWindow(desktopTwo, secondPlan);

    expect(state.windows.map((window) => window.desktopId)).toEqual([1, 2]);
    expect(state.windows.map((window) => window.title)).toEqual(["Konsole", "Konsole<2>"]);
  });

  it("creates an explicit KWrite instance on the current desktop while captions remain global", () => {
    const firstPlan = planNewApplicationInstance("kwrite", [], 1, 1, workArea, "app:kwrite", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const desktopTwo = windowReducer(firstState, { type: "switchDesktop", desktopId: 2 });
    const secondPlan = planNewApplicationInstance(
      "kwrite",
      desktopTwo.windows,
      desktopTwo.nextZIndex,
      desktopTwo.currentDesktopId,
      workArea,
      "app:kwrite::2",
      0,
    );
    const state = openPlannedWindow(desktopTwo, secondPlan);

    expect(state.windows.map((window) => window.desktopId)).toEqual([1, 2]);
    expect(state.windows.map((window) => window.title)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
    ]);
  });

  it("creates an explicit KFind instance on the current desktop while captions remain global", () => {
    const firstPlan = planNewApplicationInstance("kfind", [], 1, 1, workArea, "app:kfind", 0);
    const firstState = openPlannedWindow(createWindowManagerState([], workArea), firstPlan);
    const desktopTwo = windowReducer(firstState, { type: "switchDesktop", desktopId: 2 });
    const secondPlan = planNewApplicationInstance(
      "kfind",
      desktopTwo.windows,
      desktopTwo.nextZIndex,
      desktopTwo.currentDesktopId,
      workArea,
      "app:kfind::2",
      0,
    );
    const state = openPlannedWindow(desktopTwo, secondPlan);

    expect(state.windows.map((window) => window.desktopId)).toEqual([1, 2]);
    expect(state.windows.map((window) => window.title)).toEqual([
      "Find Files/Folders",
      "Find Files/Folders<2>",
    ]);
  });

  it("keeps the pure new-instance planner collision-safe without a Runtime allocator", () => {
    const first = createApplicationWindow(multipleFixtureDefinition, {
      zIndex: 20,
      isActive: true,
      windowId: "app:test-multiple",
    });
    const plan = planApplicationLaunchForDefinition(
      multipleFixtureDefinition,
      [first],
      30,
      1,
      workArea,
      { disposition: "new-instance" },
    );

    expect(plan).toMatchObject({ action: "open", window: { id: "app:test-multiple::2" } });
  });
});
