import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "../application-runtime/applicationRegistry";
import { createApplicationWindow } from "../application-runtime/createApplicationWindow";
import { getClockAnchoredCalendarBounds } from "../apps/calendar/calendarWindow";
import { resizeNormalWindowBounds } from "./geometry";
import { createWindowManagerState, windowReducer, type WindowManagerState } from "./windowReducer";
import type { DesktopWindow, ScreenArea, WorkArea } from "./types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};
const screenArea: ScreenArea = { x: 0, y: 0, width: 900, height: 686 };

const windows: readonly DesktopWindow[] = [
  {
    id: "about",
    appId: "about",
    title: "About die Nische",
    iconId: "about",
    desktopId: 1,
    bounds: { x: 100, y: 100, width: 320, height: 220 },
    zIndex: 20,
    isActive: false,
    state: "normal",
    isDraggable: true,
    minimumWidth: 280,
    minimumHeight: 180,
    isResizable: true,
  },
  {
    id: "konqueror",
    appId: "konqueror",
    title: "Conquer your Desktop! - Konqueror",
    iconId: "konqueror",
    desktopId: 1,
    bounds: { x: 300, y: 40, width: 500, height: 420 },
    zIndex: 30,
    isActive: true,
    state: "normal",
    isDraggable: true,
    minimumWidth: 420,
    minimumHeight: 280,
    isResizable: true,
  },
];

const makeState = (): WindowManagerState => createWindowManagerState(windows, workArea);
const aboutBounds = windows[0].bounds;
const konquerorBounds = windows[1].bounds;
const resizedAboutBounds = { x: 80, y: 70, width: 360, height: 260 };

const activeWindows = (state: WindowManagerState): DesktopWindow[] => {
  return state.windows.filter((window) => window.isActive);
};

const mobileWorkArea: WorkArea = {
  x: 0,
  y: 0,
  width: 278,
  height: 556,
  titleBarHeight: 22,
};
const mobileScreenArea: ScreenArea = { x: 0, y: 0, width: 278, height: 602 };

const getWindow = (state: WindowManagerState, id = "about"): DesktopWindow => {
  const window = state.windows.find((item) => item.id === id);

  if (!window) {
    throw new Error(`Missing test window ${id}`);
  }

  return window;
};

const getMobileNormalProfile = (state: WindowManagerState, id = "about") => {
  const profile = getWindow(state, id).normalBoundsByMode?.mobile;

  if (!profile) {
    throw new Error(`Missing mobile normal profile for ${id}`);
  }

  return profile;
};

const calendarDefinition = getApplicationDefinition("calendar");

if (!calendarDefinition) {
  throw new Error("Calendar definition is required for mobile presentation tests");
}

const mobileLargeWorkArea: WorkArea = {
  x: 0,
  y: 0,
  width: 360,
  height: 640,
  titleBarHeight: 22,
};
const mobileLargeScreenArea: ScreenArea = { x: 0, y: 0, width: 360, height: 686 };

const createCalendarWindow = (area = workArea, layoutMode: "desktop" | "mobile" = "desktop") => createApplicationWindow(
  calendarDefinition,
  {
    zIndex: 40,
    isActive: true,
    workArea: area,
    layoutMode,
  },
);

describe("windowReducer", () => {
  it("rejects direct minimize requests for visible mobile windows", () => {
    const mobile = windowReducer(createWindowManagerState(windows, mobileWorkArea), {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });

    expect(windowReducer(mobile, { type: "minimizeWindow", id: "about" })).toBe(mobile);
  });

  it("keeps desktop and mobile normal profiles independent across responsive transitions", () => {
    const desktop = createWindowManagerState(windows, workArea);
    const mobile = windowReducer(desktop, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const movedMobile = windowReducer(mobile, { type: "moveWindow", id: "about", x: 8, y: 12 });
    const backOnDesktop = windowReducer(movedMobile, {
      type: "setWorkArea",
      workArea,
      screenArea,
      layoutMode: "desktop",
    });
    const mobileAgain = windowReducer(backOnDesktop, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });

    expect(getWindow(mobile).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(getMobileNormalProfile(mobile).x).toBeGreaterThanOrEqual(4);
    expect(getMobileNormalProfile(mobile).y).toBeGreaterThanOrEqual(4);
    expect(movedMobile).toBe(mobile);
    expect(getWindow(backOnDesktop).bounds).toEqual(aboutBounds);
    expect(getWindow(mobileAgain).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(getMobileNormalProfile(mobileAgain)).toEqual(getMobileNormalProfile(mobile));
  });

  it("fits normal mobile windows and keeps every edge inside the logical work area", () => {
    const mobile = windowReducer(createWindowManagerState(windows, workArea), {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });

    for (const window of mobile.windows) {
      expect(window.bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
      const normalProfile = getMobileNormalProfile(mobile, window.id);
      expect(normalProfile.x).toBeGreaterThanOrEqual(4);
      expect(normalProfile.y).toBeGreaterThanOrEqual(4);
      expect(normalProfile.x + normalProfile.width).toBeLessThanOrEqual(274);
      expect(normalProfile.y + normalProfile.height).toBeLessThanOrEqual(552);
      expect(window.state).toBe("normal");
    }
  });

  it("rejects mobile drag and reducer-level resize while retaining the exact maximized presentation", () => {
    const mobile = windowReducer(createWindowManagerState(windows, workArea), {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const moved = windowReducer(mobile, { type: "moveWindow", id: "about", x: -500, y: 500 });
    const resized = windowReducer(moved, {
      type: "resizeWindow",
      id: "about",
      bounds: { x: 0, y: 0, width: 900, height: 900 },
    });

    expect(moved).toBe(mobile);
    expect(resized).toBe(mobile);
    expect(getWindow(resized).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(getWindow(resized).state).toBe("normal");
  });

  it("enforces the exact mobile Work Area without changing the user normal state or profile", () => {
    const mobile = windowReducer(createWindowManagerState(windows, workArea), {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const normalProfile = getMobileNormalProfile(mobile);
    const maximized = windowReducer(mobile, { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(maximized).toBe(mobile);
    expect(restored).toBe(mobile);
    expect(getWindow(restored).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(getWindow(restored).state).toBe("normal");
    expect(getMobileNormalProfile(restored)).toEqual(normalProfile);
  });

  it("preserves maximized state and restores the mode-specific profile after a desktop/mobile switch", () => {
    const desktop = createWindowManagerState(windows, workArea);
    const desktopMaximized = windowReducer(desktop, { type: "maximizeWindow", id: "about" });
    const mobileMaximized = windowReducer(desktopMaximized, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const desktopMaximizedAgain = windowReducer(mobileMaximized, {
      type: "setWorkArea",
      workArea,
      screenArea,
      layoutMode: "desktop",
    });
    const restored = windowReducer(desktopMaximizedAgain, { type: "restoreMaximizedWindow", id: "about" });

    expect(getWindow(mobileMaximized).state).toBe("maximized");
    expect(getWindow(mobileMaximized).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(getWindow(desktopMaximizedAgain).state).toBe("maximized");
    expect(getWindow(desktopMaximizedAgain).bounds).toEqual({ x: 0, y: 0, width: 900, height: 640 });
    expect(getWindow(restored).bounds).toEqual(aboutBounds);
  });

  it("keeps minimized state, active identity, and z-order through mobile work-area changes", () => {
    const desktop = createWindowManagerState(windows, workArea);
    const minimized = windowReducer(desktop, { type: "minimizeWindow", id: "konqueror" });
    const mobile = windowReducer(minimized, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });

    expect(getWindow(mobile, "konqueror").state).toBe("minimized");
    expect(mobile.windows.map((window) => window.id)).toEqual(desktop.windows.map((window) => window.id));
    expect(mobile.windows.map((window) => window.zIndex)).toEqual(desktop.windows.map((window) => window.zIndex));
    expect(mobile.windows.find((window) => window.isActive)?.id).toBe(
      minimized.windows.find((window) => window.isActive)?.id,
    );
  });

  it("preserves window identity, active desktop, z-order, and launcher metadata through portrait rotation", () => {
    const rotationWindows: readonly DesktopWindow[] = [
      { ...windows[0], desktopId: 1, isActive: false },
      { ...windows[1], desktopId: 2, isActive: true },
    ];
    const landscapeWorkArea: WorkArea = {
      x: 0,
      y: 0,
      width: 844,
      height: 344,
      titleBarHeight: 22,
    };
    const landscapeScreenArea: ScreenArea = { x: 0, y: 0, width: 844, height: 390 };
    const desktop = createWindowManagerState(rotationWindows, workArea, 2, 4);
    const annotated = windowReducer(desktop, {
      type: "setWindowLauncherMetadata",
      id: "konqueror",
      metadata: { isHomeLocation: true, semanticIconId: "home" },
    });
    const mobile = windowReducer(annotated, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const landscape = windowReducer(mobile, {
      type: "setWorkArea",
      workArea: landscapeWorkArea,
      screenArea: landscapeScreenArea,
      layoutMode: "desktop",
    });
    const portraitAgain = windowReducer(landscape, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });

    expect(portraitAgain.currentDesktopId).toBe(annotated.currentDesktopId);
    expect(portraitAgain.lastActiveWindowIdByDesktop).toEqual(annotated.lastActiveWindowIdByDesktop);
    expect(portraitAgain.windows.map((window) => window.id)).toEqual(annotated.windows.map((window) => window.id));
    expect(portraitAgain.windows.map((window) => window.zIndex)).toEqual(annotated.windows.map((window) => window.zIndex));
    expect(portraitAgain.windows.map((window) => window.isActive)).toEqual(annotated.windows.map((window) => window.isActive));
    expect(portraitAgain.launcherMetadataByWindowId).toEqual(annotated.launcherMetadataByWindowId);
    expect(portraitAgain.layoutMode).toBe("mobile");
    expect(portraitAgain.windows.find((window) => window.isActive)?.desktopId).toBe(2);
  });

  it("creates a valid desktop profile for a window first opened in mobile mode", () => {
    const definition = getApplicationDefinition("kcalc");

    if (!definition) {
      throw new Error("KCalc definition is required for responsive geometry tests");
    }

    const mobileWindow = createApplicationWindow(definition, {
      zIndex: 1,
      isActive: true,
      workArea: mobileWorkArea,
      layoutMode: "mobile",
    });
    const mobile = windowReducer(
      createWindowManagerState([], mobileWorkArea, 1, 4, "mobile"),
      { type: "openWindow", window: mobileWindow },
    );
    const desktop = windowReducer(mobile, {
      type: "setWorkArea",
      workArea,
      screenArea,
      layoutMode: "desktop",
    });

    expect(getWindow(mobile, mobileWindow.id).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(getMobileNormalProfile(mobile, mobileWindow.id).width).toBeLessThanOrEqual(270);
    expect(getWindow(desktop, mobileWindow.id).bounds).toEqual({ x: 314, y: 179, width: 273, height: 282 });
  });

  it("keeps Calendar normal on mobile while representative applications remain enforced-maximized", () => {
    const calendar = createCalendarWindow();
    const desktop = createWindowManagerState([
      calendar,
      { ...windows[0], isActive: false },
    ], workArea);
    const mobile = windowReducer(desktop, {
      type: "setWorkArea",
      workArea: mobileLargeWorkArea,
      screenArea: mobileLargeScreenArea,
      layoutMode: "mobile",
    });

    expect(getWindow(mobile, calendar.id).state).toBe("normal");
    expect(getWindow(mobile, calendar.id).bounds).not.toEqual({ x: 0, y: 0, width: 360, height: 640 });
    expect(getWindow(mobile, "about").bounds).toEqual({ x: 0, y: 0, width: 360, height: 640 });
  });

  it("opens Calendar directly at centered mobile normal bounds", () => {
    const calendar = createCalendarWindow(mobileLargeWorkArea, "mobile");
    const mobile = windowReducer(
      createWindowManagerState([], mobileLargeWorkArea, 1, 4, "mobile"),
      { type: "openWindow", window: calendar },
    );
    const opened = getWindow(mobile, calendar.id);
    const safeRect = { x: 4, y: 4, width: 352, height: 632 };

    expect(opened.state).toBe("normal");
    expect(opened.bounds).toEqual({ x: 28, y: 211, width: 304, height: 218 });
    expect(opened.bounds).not.toEqual({ x: 0, y: 0, width: 360, height: 640 });
    expect(opened.bounds.x).toBeGreaterThanOrEqual(safeRect.x);
    expect(opened.bounds.y).toBeGreaterThanOrEqual(safeRect.y);
    expect(opened.bounds.x + opened.bounds.width).toBeLessThanOrEqual(safeRect.x + safeRect.width);
    expect(opened.bounds.y + opened.bounds.height).toBeLessThanOrEqual(safeRect.y + safeRect.height);
  });

  it("preserves a Clock anchor when Calendar first opens in a mobile viewport", () => {
    const smallMobileWorkArea: WorkArea = { x: 0, y: 0, width: 320, height: 522, titleBarHeight: 22 };
    const anchoredBounds = getClockAnchoredCalendarBounds(
      { right: 315, top: smallMobileWorkArea.height },
      smallMobileWorkArea,
    );
    const calendar = createApplicationWindow(calendarDefinition, {
      zIndex: 1,
      isActive: true,
      workArea: smallMobileWorkArea,
      initialBounds: anchoredBounds,
      layoutMode: "mobile",
    });
    const opened = getWindow(
      windowReducer(
        createWindowManagerState([], smallMobileWorkArea, 1, 4, "mobile"),
        { type: "openWindow", window: calendar },
      ),
      calendar.id,
    );

    expect(opened.bounds).toEqual(anchoredBounds);
    expect(opened.bounds.x + opened.bounds.width).toBeLessThanOrEqual(smallMobileWorkArea.width);
    expect(opened.bounds.y + opened.bounds.height).toBe(smallMobileWorkArea.height);
  });

  it.each([
    { width: 320, height: 522 },
    { width: 430, height: 886 },
  ])("keeps an anchored Calendar contained without stretching it at %sx%s", ({ width, height }) => {
    const area: WorkArea = { x: 0, y: 0, width, height, titleBarHeight: 22 };
    const anchoredBounds = getClockAnchoredCalendarBounds({ right: width - 5, top: height }, area);
    const calendar = createApplicationWindow(calendarDefinition, {
      zIndex: 1,
      isActive: true,
      workArea: area,
      initialBounds: anchoredBounds,
      layoutMode: "mobile",
    });
    const opened = getWindow(
      windowReducer(createWindowManagerState([], area, 1, 4, "mobile"), { type: "openWindow", window: calendar }),
      calendar.id,
    );

    expect(opened.bounds).toEqual(anchoredBounds);
    expect(opened.bounds.width).toBe(304);
    expect(opened.bounds.height).toBe(218);
    expect(opened.bounds.x + opened.bounds.width).toBeLessThanOrEqual(area.width);
    expect(opened.bounds.y + opened.bounds.height).toBeLessThanOrEqual(area.height);
  });

  it("fully clamps an anchored Calendar after a desktop work-area resize", () => {
    const anchoredBounds = getClockAnchoredCalendarBounds({ right: workArea.width, top: workArea.height }, workArea);
    const calendar = createApplicationWindow(calendarDefinition, {
      zIndex: 1,
      isActive: true,
      workArea,
      initialBounds: anchoredBounds,
    });
    const initial = createWindowManagerState([calendar], workArea);
    const resizedWorkArea: WorkArea = { ...workArea, width: 500 };
    const resized = windowReducer(initial, {
      type: "setWorkArea",
      workArea: resizedWorkArea,
      screenArea: { x: 0, y: 0, width: 500, height: 686 },
      layoutMode: "desktop",
    });
    const resizedCalendar = getWindow(resized, calendar.id);

    expect(resizedCalendar.bounds.x + resizedCalendar.bounds.width).toBe(resizedWorkArea.width);
    expect(resizedCalendar.bounds.x).toBe(resizedWorkArea.width - resizedCalendar.bounds.width);
    expect(resizedCalendar.bounds.y + resizedCalendar.bounds.height).toBeLessThanOrEqual(resizedWorkArea.height);
  });

  it("preserves Calendar desktop and mobile profiles through rotation", () => {
    const calendar = createCalendarWindow();
    const desktop = createWindowManagerState([calendar], workArea);
    const mobile = windowReducer(desktop, {
      type: "setWorkArea",
      workArea: mobileLargeWorkArea,
      screenArea: mobileLargeScreenArea,
      layoutMode: "mobile",
    });
    const mobileBounds = getWindow(mobile, calendar.id).bounds;
    const landscape = windowReducer(mobile, {
      type: "setWorkArea",
      workArea: { ...workArea, width: 603, height: 248 },
      screenArea: { x: 0, y: 0, width: 603, height: 390 },
      layoutMode: "desktop",
    });
    const portraitAgain = windowReducer(landscape, {
      type: "setWorkArea",
      workArea: mobileLargeWorkArea,
      screenArea: mobileLargeScreenArea,
      layoutMode: "mobile",
    });

    expect(getWindow(landscape, calendar.id).bounds.x + getWindow(landscape, calendar.id).bounds.width).toBeLessThanOrEqual(603);
    expect(getWindow(landscape, calendar.id).bounds.y + getWindow(landscape, calendar.id).bounds.height).toBeLessThanOrEqual(248);
    expect(getWindow(portraitAgain, calendar.id).bounds).toEqual(mobileBounds);
    expect(getWindow(portraitAgain, calendar.id).state).toBe("normal");
  });

  it("preserves a desktop-maximized Calendar state while presenting its mobile normal profile", () => {
    const calendar = createCalendarWindow();
    const desktop = createWindowManagerState([calendar], workArea);
    const desktopNormalBounds = getWindow(desktop, calendar.id).bounds;
    const desktopMaximized = windowReducer(desktop, { type: "maximizeWindow", id: calendar.id });
    const mobile = windowReducer(desktopMaximized, {
      type: "setWorkArea",
      workArea: mobileLargeWorkArea,
      screenArea: mobileLargeScreenArea,
      layoutMode: "mobile",
    });
    const desktopAgain = windowReducer(mobile, {
      type: "setWorkArea",
      workArea,
      screenArea,
      layoutMode: "desktop",
    });
    const restored = windowReducer(desktopAgain, { type: "restoreMaximizedWindow", id: calendar.id });

    expect(getWindow(mobile, calendar.id).state).toBe("maximized");
    expect(getWindow(mobile, calendar.id).bounds).not.toEqual({ x: 0, y: 0, width: 360, height: 640 });
    expect(getWindow(desktopAgain, calendar.id).state).toBe("maximized");
    expect(getWindow(desktopAgain, calendar.id).bounds).toEqual({ x: 0, y: 0, width: 900, height: 640 });
    expect(getWindow(restored, calendar.id).state).toBe("normal");
    expect(getWindow(restored, calendar.id).bounds).toEqual(desktopNormalBounds);
  });

  it("shrinks Calendar for a smaller mobile work area without stretching it after expansion", () => {
    const calendar = createCalendarWindow(mobileLargeWorkArea, "mobile");
    const mobile = windowReducer(
      createWindowManagerState([], mobileLargeWorkArea, 1, 4, "mobile"),
      { type: "openWindow", window: calendar },
    );
    const smallerWorkArea: WorkArea = { ...mobileLargeWorkArea, width: 228, height: 360 };
    const smallerScreenArea: ScreenArea = { x: 0, y: 0, width: 228, height: 406 };
    const shrunk = windowReducer(mobile, {
      type: "setWorkArea",
      workArea: smallerWorkArea,
      screenArea: smallerScreenArea,
      layoutMode: "mobile",
    });
    const expanded = windowReducer(shrunk, {
      type: "setWorkArea",
      workArea: mobileLargeWorkArea,
      screenArea: mobileLargeScreenArea,
      layoutMode: "mobile",
    });

    expect(getWindow(shrunk, calendar.id).bounds.width).toBeLessThanOrEqual(228);
    expect(getWindow(shrunk, calendar.id).bounds.height).toBeLessThanOrEqual(352);
    expect(getWindow(expanded, calendar.id).bounds.width).toBe(getWindow(shrunk, calendar.id).bounds.width);
    expect(getWindow(expanded, calendar.id).bounds.height).toBe(getWindow(shrunk, calendar.id).bounds.height);
    expect(getWindow(expanded, calendar.id).bounds).not.toEqual({ x: 0, y: 0, width: 360, height: 640 });
  });

  it("reconciles mobile shrink without enlarging a normal window when the area expands", () => {
    const mobile = windowReducer(createWindowManagerState(windows, workArea), {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const smallerWorkArea: WorkArea = { ...mobileWorkArea, width: 240, height: 400 };
    const smallerScreenArea: ScreenArea = { ...mobileScreenArea, width: 240, height: 446 };
    const shrunk = windowReducer(mobile, {
      type: "setWorkArea",
      workArea: smallerWorkArea,
      screenArea: smallerScreenArea,
      layoutMode: "mobile",
    });
    const expanded = windowReducer(shrunk, {
      type: "setWorkArea",
      workArea: mobileWorkArea,
      screenArea: mobileScreenArea,
      layoutMode: "mobile",
    });
    const movedAfterExpansion = windowReducer(expanded, {
      type: "moveWindow",
      id: "about",
      x: 20,
      y: 20,
    });

    expect(getMobileNormalProfile(shrunk).x + getMobileNormalProfile(shrunk).width).toBeLessThanOrEqual(236);
    expect(getMobileNormalProfile(shrunk).y + getMobileNormalProfile(shrunk).height).toBeLessThanOrEqual(396);
    expect(getMobileNormalProfile(expanded).width).toBe(getMobileNormalProfile(shrunk).width);
    expect(getMobileNormalProfile(expanded).height).toBe(getMobileNormalProfile(shrunk).height);
    expect(getWindow(expanded).bounds).toEqual({ x: 0, y: 0, width: 278, height: 556 });
    expect(movedAfterExpansion).toBe(expanded);
  });

  it("keeps a non-minimizable window visible through runtime and taskbar minimize requests", () => {
    const state = createWindowManagerState([
      { ...windows[0], id: "calendar", appId: "calendar", isActive: true, isMinimizable: false, alwaysOnTop: true },
    ], workArea);
    const runtimeRequest = windowReducer(state, { type: "minimizeWindow", id: "calendar" });
    const taskbarRequest = windowReducer(runtimeRequest, { type: "toggleTaskbarWindow", id: "calendar" });

    expect(runtimeRequest.windows[0]?.state).toBe("normal");
    expect(taskbarRequest.windows[0]?.state).toBe("normal");
    expect(taskbarRequest.windows[0]?.isActive).toBe(true);
  });

  it("keeps an always-on-top window visually above a later normal activation without stealing focus", () => {
    const state = createWindowManagerState([
      { ...windows[0], id: "calendar", appId: "calendar", zIndex: 1_000_010, isActive: true, alwaysOnTop: true },
      { ...windows[1], id: "normal", appId: "konqueror", zIndex: 30, isActive: false },
    ], workArea);
    const activated = windowReducer(state, { type: "activateWindow", id: "normal" });
    const calendar = activated.windows.find((window) => window.id === "calendar");
    const normal = activated.windows.find((window) => window.id === "normal");

    expect(normal?.isActive).toBe(true);
    expect(calendar?.isActive).toBe(false);
    expect(calendar?.zIndex).toBeGreaterThan(normal?.zIndex ?? 0);
  });

  it("updates only the requested window title for a dynamic application location", () => {
    const state = windowReducer(makeState(), {
      type: "setWindowTitle",
      id: "konqueror",
      title: "My Computer - Konqueror",
    });

    expect(state.windows.find((window) => window.id === "konqueror")?.title).toBe("My Computer - Konqueror");
    expect(state.windows.find((window) => window.id === "about")?.title).toBe("About die Nische");
  });

  it("resets only volatile window-session state without touching work area", () => {
    const state = makeState();
    const reset = windowReducer(state, { type: "resetSession" });

    expect(reset.windows).toEqual([]);
    expect(reset.currentDesktopId).toBe(1);
    expect(reset.lastActiveWindowIdByDesktop).toEqual({ 1: null, 2: null, 3: null, 4: null });
    expect(reset.showDesktopSessionByDesktop).toEqual({ 1: null, 2: null, 3: null, 4: null });
    expect(reset.launcherMetadataByWindowId).toEqual({});
    expect(reset.workArea).toEqual(state.workArea);
  });

  it("keeps semantic task icon metadata scoped to its WindowId and clears it with that window", () => {
    const first = windowReducer(makeState(), {
      type: "setWindowLauncherMetadata",
      id: "konqueror",
      metadata: { isHomeLocation: false, semanticIconId: "documents" },
    });
    const second = windowReducer(first, {
      type: "setWindowLauncherMetadata",
      id: "about",
      metadata: { isHomeLocation: false, semanticIconId: "trash" },
    });
    const closed = windowReducer(second, { type: "closeWindow", id: "konqueror" });

    expect(second.launcherMetadataByWindowId).toEqual({
      konqueror: { isHomeLocation: false, semanticIconId: "documents" },
      about: { isHomeLocation: false, semanticIconId: "trash" },
    });
    expect(closed.launcherMetadataByWindowId).toEqual({
      about: { isHomeLocation: false, semanticIconId: "trash" },
    });
  });
  it("marks other windows inactive when activating a window", () => {
    const state = windowReducer(makeState(), { type: "activateWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(state.windows.find((window) => window.id === "konqueror")?.isActive).toBe(false);
  });

  it("raises the activated window above other windows", () => {
    const state = windowReducer(makeState(), { type: "activateWindow", id: "about" });
    const aboutWindow = state.windows.find((window) => window.id === "about");
    const konquerorWindow = state.windows.find((window) => window.id === "konqueror");

    expect(aboutWindow?.zIndex).toBeGreaterThan(konquerorWindow?.zIndex ?? 0);
  });

  it("emits a fresh focus request for explicit activation without changing the active window identity", () => {
    const active = makeState();
    const repeated = windowReducer(active, { type: "activateWindow", id: "konqueror" });

    expect(repeated.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
    expect(repeated.windows.find((window) => window.id === "konqueror")?.focusRequestId).toBeGreaterThan(
      active.windows.find((window) => window.id === "konqueror")?.focusRequestId ?? 0,
    );
    expect(repeated.windows.find((window) => window.id === "konqueror")?.zIndex).toBe(
      active.windows.find((window) => window.id === "konqueror")?.zIndex,
    );
  });

  it("moveWindow changes only the target window position", () => {
    const state = windowReducer(makeState(), { type: "moveWindow", id: "about", x: 180, y: 150 });
    const aboutWindow = state.windows.find((window) => window.id === "about");
    const konquerorWindow = state.windows.find((window) => window.id === "konqueror");

    expect(aboutWindow?.bounds).toEqual({ x: 180, y: 150, width: 320, height: 220 });
    expect(konquerorWindow?.bounds).toEqual({ x: 300, y: 40, width: 500, height: 420 });
  });

  it("moves a fixed non-maximizable normal window without changing its natural size", () => {
    const state = createWindowManagerState([
      { ...windows[0], isResizable: false, isMaximizable: false, bounds: { x: 700, y: 180, width: 273, height: 282 } },
    ], workArea);
    const moved = windowReducer(state, { type: "moveWindow", id: "about", x: 900, y: 300 });

    expect(moved.windows[0]?.bounds).toEqual({ x: 836, y: 300, width: 273, height: 282 });
  });

  it("keeps normal drag bounds recoverable instead of clamping the full window to the work area", () => {
    const moved = windowReducer(makeState(), {
      type: "moveWindow",
      id: "about",
      x: -600,
      y: 900,
      screenArea,
    });
    const about = moved.windows.find((window) => window.id === "about");

    expect(about?.bounds).toEqual({ x: -256, y: 618, width: 320, height: 220 });
    expect(about?.bounds.y).toBeGreaterThan(workArea.height - about!.bounds.height);
  });

  it("preserves partial normal bounds through maximize and restore", () => {
    const moved = windowReducer(makeState(), {
      type: "moveWindow",
      id: "about",
      x: -600,
      y: 900,
      screenArea,
    });
    const maximized = windowReducer(moved, { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(maximized.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 900,
      height: 640,
    });
    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: -256,
      y: 618,
      width: 320,
      height: 220,
    });
  });

  it("keeps partial normal bounds across minimize and restore", () => {
    const moved = windowReducer(makeState(), {
      type: "moveWindow",
      id: "about",
      x: 860,
      y: 900,
      screenArea,
    });
    const minimized = windowReducer(moved, { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual(
      moved.windows.find((window) => window.id === "about")?.bounds,
    );
  });

  it("reclamps normal and maximized restore bounds to the new viewport recovery policy", () => {
    const partial = windowReducer(makeState(), {
      type: "moveWindow",
      id: "about",
      x: 860,
      y: 900,
      screenArea,
    });
    const maximized = windowReducer(partial, { type: "maximizeWindow", id: "about" });
    const shrunkWorkArea = { ...workArea, width: 500, height: 320 };
    const shrunkScreen: ScreenArea = { x: 0, y: 0, width: 500, height: 366 };
    const resized = windowReducer(maximized, {
      type: "setWorkArea",
      workArea: shrunkWorkArea,
      screenArea: shrunkScreen,
    });
    const restored = windowReducer(resized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: 436,
      y: 298,
      width: 320,
      height: 220,
    });
  });

  it("ignores unknown ids without breaking state", () => {
    const state = makeState();

    expect(windowReducer(state, { type: "activateWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "moveWindow", id: "missing", x: 1, y: 1 })).toBe(state);
    expect(windowReducer(state, { type: "resizeWindow", id: "missing", bounds: resizedAboutBounds })).toBe(state);
    expect(windowReducer(state, { type: "minimizeWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "restoreWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "maximizeWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "restoreMaximizedWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "toggleMaximizeWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "closeWindow", id: "missing" })).toBe(state);
    expect(windowReducer(state, { type: "toggleTaskbarWindow", id: "missing" })).toBe(state);
  });

  it("sets a normal window to minimized", () => {
    const state = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.state).toBe("minimized");
  });

  it("keeps bounds unchanged when minimizing a window", () => {
    const originalBounds = makeState().windows.find((window) => window.id === "about")?.bounds;
    const state = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.bounds).toEqual(originalBounds);
  });

  it("activates the highest z-index visible window after minimizing the active window", () => {
    const state = createWindowManagerState(
      [
        ...windows,
        {
          id: "notes",
          appId: "notes",
          title: "Notes",
          iconId: "about",
          desktopId: 1,
          bounds: { x: 40, y: 40, width: 200, height: 160 },
          zIndex: 25,
          isActive: false,
          state: "normal",
          isDraggable: true,
          minimumWidth: 180,
          minimumHeight: 120,
          isResizable: true,
        },
      ],
      workArea,
    );
    const minimized = windowReducer(state, { type: "minimizeWindow", id: "konqueror" });

    expect(minimized.windows.find((window) => window.id === "about")?.isActive).toBe(false);
    expect(minimized.windows.find((window) => window.id === "notes")?.isActive).toBe(true);
  });

  it("does not change the current active window when minimizing an inactive window", () => {
    const state = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
  });

  it("allows no active window when all windows are minimized", () => {
    const first = windowReducer(makeState(), { type: "minimizeWindow", id: "konqueror" });
    const second = windowReducer(first, { type: "minimizeWindow", id: "about" });

    expect(activeWindows(second)).toEqual([]);
  });

  it("restores a minimized window to normal", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.state).toBe("normal");
  });

  it("activates a restored window", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(restored.windows.find((window) => window.id === "konqueror")?.isActive).toBe(false);
  });

  it("emits a fresh focus request for the exact restored window", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.focusRequestId).toBeGreaterThan(
      minimized.windows.find((window) => window.id === "about")?.focusRequestId ?? 0,
    );
    expect(restored.windows.find((window) => window.id === "konqueror")?.focusRequestId).toBe(
      minimized.windows.find((window) => window.id === "konqueror")?.focusRequestId,
    );
  });

  it("raises a restored window above all others", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });
    const aboutWindow = restored.windows.find((window) => window.id === "about");
    const konquerorWindow = restored.windows.find((window) => window.id === "konqueror");

    expect(aboutWindow?.zIndex).toBeGreaterThan(konquerorWindow?.zIndex ?? 0);
  });

  it("taskbar toggle minimizes an active normal window", () => {
    const state = windowReducer(makeState(), { type: "toggleTaskbarWindow", id: "konqueror" });

    expect(state.windows.find((window) => window.id === "konqueror")?.state).toBe("minimized");
  });

  it("hands application focus to the exact fallback after active minimize or close", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "konqueror" });
    const closed = windowReducer(makeState(), { type: "closeWindow", id: "konqueror" });

    expect(minimized.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(minimized.windows.find((window) => window.id === "about")?.focusRequestId).toBeGreaterThan(
      makeState().windows.find((window) => window.id === "about")?.focusRequestId ?? 0,
    );
    expect(closed.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(closed.windows.find((window) => window.id === "about")?.focusRequestId).toBeGreaterThan(
      makeState().windows.find((window) => window.id === "about")?.focusRequestId ?? 0,
    );
  });

  it("taskbar toggle activates an inactive normal window", () => {
    const state = windowReducer(makeState(), { type: "toggleTaskbarWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(state.windows.find((window) => window.id === "about")?.state).toBe("normal");
  });

  it("taskbar toggle restores a minimized window", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "toggleTaskbarWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.state).toBe("normal");
    expect(restored.windows.find((window) => window.id === "about")?.isActive).toBe(true);
  });

  it("taskbar operations do not change window bounds", () => {
    const originalBounds = makeState().windows.map((window) => [window.id, window.bounds] as const);
    const state = windowReducer(makeState(), { type: "toggleTaskbarWindow", id: "about" });

    expect(state.windows.map((window) => [window.id, window.bounds] as const)).toEqual(originalBounds);
  });

  it("keeps taskbar order stable when activating windows", () => {
    const state = windowReducer(makeState(), { type: "activateWindow", id: "about" });

    expect(state.windows.map((window) => window.id)).toEqual(["about", "konqueror"]);
  });

  it("never creates two active windows", () => {
    const states = [
      windowReducer(makeState(), { type: "activateWindow", id: "about" }),
      windowReducer(makeState(), { type: "minimizeWindow", id: "konqueror" }),
      windowReducer(windowReducer(makeState(), { type: "minimizeWindow", id: "about" }), {
        type: "restoreWindow",
        id: "about",
      }),
      windowReducer(makeState(), { type: "toggleTaskbarWindow", id: "about" }),
      windowReducer(makeState(), { type: "maximizeWindow", id: "about" }),
      windowReducer(makeState(), { type: "closeWindow", id: "konqueror" }),
    ];

    states.forEach((state) => {
      expect(activeWindows(state).length).toBeLessThanOrEqual(1);
    });
  });

  it("maximizes a normal window", () => {
    const state = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const aboutWindow = state.windows.find((window) => window.id === "about");

    expect(aboutWindow?.state).toBe("maximized");
  });

  it("sets maximized bounds to the work area", () => {
    const state = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
    });
  });

  it("saves restoreBounds before maximizing", () => {
    const state = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.restoreBounds).toEqual(aboutBounds);
  });

  it("makes a maximized window the only active window", () => {
    const state = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(state.windows.find((window) => window.id === "konqueror")?.isActive).toBe(false);
  });

  it("raises a maximized window above all others", () => {
    const state = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const aboutWindow = state.windows.find((window) => window.id === "about");
    const konquerorWindow = state.windows.find((window) => window.id === "konqueror");

    expect(aboutWindow?.zIndex).toBeGreaterThan(konquerorWindow?.zIndex ?? 0);
  });

  it("does not create invalid state when maximizing an already maximized top active window", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const repeated = windowReducer(maximized, { type: "maximizeWindow", id: "about" });

    expect(repeated).toBe(maximized);
    expect(activeWindows(repeated)).toHaveLength(1);
    expect(repeated.windows.find((window) => window.id === "about")?.state).toBe("maximized");
  });

  it("rejects direct maximize and toggle requests for a non-maximizable window", () => {
    const state = createWindowManagerState([{ ...windows[0], isMaximizable: false }], workArea);
    const maximized = windowReducer(state, { type: "maximizeWindow", id: "about" });
    const toggled = windowReducer(state, { type: "toggleMaximizeWindow", id: "about" });

    expect(maximized).toBe(state);
    expect(toggled).toBe(state);
  });

  it("restores a maximized window to normal", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.state).toBe("normal");
  });

  it("restores maximized bounds from restoreBounds", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual(aboutBounds);
  });

  it("clears restoreBounds after restoring from maximized", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.restoreBounds).toBeUndefined();
  });

  it("safely restores a maximized window with missing restoreBounds", () => {
    const state = createWindowManagerState(
      [
        {
          ...windows[0],
          state: "maximized",
          bounds: { x: 0, y: 0, width: workArea.width, height: workArea.height },
          restoreBounds: undefined,
          isActive: true,
        },
      ],
      workArea,
    );
    const restored = windowReducer(state, { type: "restoreMaximizedWindow", id: "about" });
    const restoredWindow = restored.windows[0];

    expect(restoredWindow.state).toBe("normal");
    expect(restoredWindow.bounds.y + workArea.titleBarHeight).toBeLessThanOrEqual(workArea.height);
  });

  it("keeps a restored maximized window active", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(activeWindows(restored)).toHaveLength(1);
  });

  it("does not drift bounds across repeated maximize and restore", () => {
    const firstMaximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const firstRestored = windowReducer(firstMaximized, { type: "restoreMaximizedWindow", id: "about" });
    const secondMaximized = windowReducer(firstRestored, { type: "maximizeWindow", id: "about" });
    const secondRestored = windowReducer(secondMaximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(firstRestored.windows.find((window) => window.id === "about")?.bounds).toEqual(aboutBounds);
    expect(secondRestored.windows.find((window) => window.id === "about")?.bounds).toEqual(aboutBounds);
  });

  it("records maximized state before minimizing a maximized window", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "about" });

    expect(minimized.windows.find((window) => window.id === "about")?.stateBeforeMinimize).toBe("maximized");
  });

  it("restores minimized maximized windows back to maximized", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.state).toBe("maximized");
  });

  it("uses current work area when restoring a minimized maximized window", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "about" });
    const resized = windowReducer(minimized, {
      type: "setWorkArea",
      workArea: { ...workArea, width: 500, height: 320 },
    });
    const restored = windowReducer(resized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 320,
    });
  });

  it("restores normal minimized windows back to normal", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.state).toBe("normal");
  });

  it("does not overwrite restoreBounds when minimizing a maximized window", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "about" });

    expect(minimized.windows.find((window) => window.id === "about")?.restoreBounds).toEqual(aboutBounds);
  });

  it("updates maximized bounds when work area changes", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const resized = windowReducer(maximized, {
      type: "setWorkArea",
      workArea: { ...workArea, width: 480, height: 300 },
    });

    expect(resized.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 480,
      height: 300,
    });
  });

  it("restores from maximized after resize using recoverable original normal bounds", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "konqueror" });
    const resized = windowReducer(maximized, {
      type: "setWorkArea",
      workArea: { ...workArea, width: 400, height: 300 },
    });
    const restored = windowReducer(resized, { type: "restoreMaximizedWindow", id: "konqueror" });

    expect(restored.windows.find((window) => window.id === "konqueror")?.bounds).toEqual({
      ...konquerorBounds,
      x: 300,
    });
  });

  it("closes a target window", () => {
    const state = windowReducer(makeState(), { type: "closeWindow", id: "about" });

    expect(state.windows.map((window) => window.id)).toEqual(["konqueror"]);
  });

  it("keeps remaining window order stable after close", () => {
    const state = createWindowManagerState(
      [
        windows[0],
        {
          ...windows[0],
          id: "notes",
          title: "Notes",
          zIndex: 25,
        },
        windows[1],
      ],
      workArea,
    );
    const closed = windowReducer(state, { type: "closeWindow", id: "notes" });

    expect(closed.windows.map((window) => window.id)).toEqual(["about", "konqueror"]);
  });

  it("activates the highest z-index visible window after closing the active window", () => {
    const state = windowReducer(makeState(), { type: "activateWindow", id: "about" });
    const closed = windowReducer(state, { type: "closeWindow", id: "about" });

    expect(closed.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
  });

  it("does not change current active window when closing an inactive window", () => {
    const state = windowReducer(makeState(), { type: "closeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
    expect(state.windows.find((window) => window.id === "konqueror")?.zIndex).toBe(30);
  });

  it("allows the final window to close", () => {
    const first = windowReducer(makeState(), { type: "closeWindow", id: "about" });
    const second = windowReducer(first, { type: "closeWindow", id: "konqueror" });

    expect(second.windows).toEqual([]);
  });

  it("does not change other window bounds when closing a window", () => {
    const state = windowReducer(makeState(), { type: "closeWindow", id: "about" });

    expect(state.windows.find((window) => window.id === "konqueror")?.bounds).toEqual(konquerorBounds);
  });

  it("opens a new window as the only active window", () => {
    const newWindow: DesktopWindow = {
      ...windows[0],
      id: "new-about",
      appId: "about",
      isActive: false,
      zIndex: 1,
    };
    const state = windowReducer(makeState(), { type: "openWindow", window: newWindow });

    expect(state.windows.map((window) => window.id)).toEqual(["about", "konqueror", "new-about"]);
    expect(state.windows.find((window) => window.id === "new-about")?.isActive).toBe(true);
    expect(activeWindows(state)).toHaveLength(1);
  });

  it("opens a new window at nextZIndex", () => {
    const newWindow: DesktopWindow = {
      ...windows[0],
      id: "new-about",
      zIndex: 1,
    };
    const state = windowReducer(makeState(), { type: "openWindow", window: newWindow });

    expect(state.windows.find((window) => window.id === "new-about")?.zIndex).toBe(makeState().nextZIndex);
  });

  it("does not replace an existing window id when opening", () => {
    const state = makeState();
    const duplicate: DesktopWindow = {
      ...windows[0],
      id: "about",
      bounds: { x: 0, y: 0, width: 900, height: 640 },
    };

    expect(windowReducer(state, { type: "openWindow", window: duplicate })).toBe(state);
  });

  it("constrains opened window bounds to the current work area", () => {
    const state = createWindowManagerState([], { ...workArea, width: 300, height: 200 });
    const newWindow: DesktopWindow = {
      ...windows[1],
      id: "new-konqueror",
    };
    const opened = windowReducer(state, { type: "openWindow", window: newWindow });

    expect(opened.windows[0].bounds.x).toBe(0);
    expect(opened.windows[0].bounds.y + workArea.titleBarHeight).toBeLessThanOrEqual(200);
  });

  it("resizes a normal resizable window", () => {
    const state = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(state.windows.find((window) => window.id === "about")?.bounds).toEqual(resizedAboutBounds);
  });

  it("stores oversized normal resize bounds canonically and restores them exactly after maximize", () => {
    const oversizedBounds = resizeNormalWindowBounds({
      initialBounds: aboutBounds,
      direction: "se",
      deltaX: 1_200,
      deltaY: 900,
      minimumWidth: windows[0].minimumWidth,
      minimumHeight: windows[0].minimumHeight,
      screenArea,
    });
    const resized = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: oversizedBounds });
    const maximized = windowReducer(resized, { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(resized.windows.find((window) => window.id === "about")?.bounds).toEqual(oversizedBounds);
    expect(maximized.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 900,
      height: 640,
    });
    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual(oversizedBounds);
  });

  it("preserves oversized resized bounds through minimize, desktop moves, and viewport recovery", () => {
    const oversizedBounds = resizeNormalWindowBounds({
      initialBounds: aboutBounds,
      direction: "se",
      deltaX: 1_200,
      deltaY: 900,
      minimumWidth: windows[0].minimumWidth,
      minimumHeight: windows[0].minimumHeight,
      screenArea,
    });
    const resized = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: oversizedBounds });
    const minimized = windowReducer(resized, { type: "minimizeWindow", id: "about" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "about" });
    const moved = windowReducer(restored, { type: "moveWindowToDesktop", id: "about", desktopId: 2 });
    const shrunk = windowReducer(moved, {
      type: "setWorkArea",
      workArea: { ...workArea, width: 500, height: 320 },
      screenArea: { x: 0, y: 0, width: 500, height: 366 },
    });
    const about = shrunk.windows.find((window) => window.id === "about");

    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual(oversizedBounds);
    expect(moved.windows.find((window) => window.id === "about")?.bounds).toEqual(oversizedBounds);
    expect(about?.bounds.width).toBe(oversizedBounds.width);
    expect(about?.bounds.height).toBe(oversizedBounds.height);
    expect(about?.bounds.x).toBe(oversizedBounds.x);
    expect(about?.bounds.y).toBe(oversizedBounds.y);
  });

  it("resize does not change window state", () => {
    const state = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(state.windows.find((window) => window.id === "about")?.state).toBe("normal");
  });

  it("resize does not change z-index", () => {
    const state = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(state.windows.find((window) => window.id === "about")?.zIndex).toBe(20);
  });

  it("resize does not change active state", () => {
    const state = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(state.windows.find((window) => window.id === "about")?.isActive).toBe(false);
    expect(state.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
  });

  it("resize keeps window order stable", () => {
    const state = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(state.windows.map((window) => window.id)).toEqual(["about", "konqueror"]);
  });

  it("ignores resize for maximized windows", () => {
    const maximized = windowReducer(makeState(), { type: "maximizeWindow", id: "about" });
    const resized = windowReducer(maximized, { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(resized).toBe(maximized);
  });

  it("ignores resize for minimized windows", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const resized = windowReducer(minimized, { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(resized).toBe(minimized);
  });

  it("ignores resize for non-resizable windows", () => {
    const state = createWindowManagerState([{ ...windows[0], isResizable: false }], workArea);
    const resized = windowReducer(state, { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(resized).toBe(state);
  });

  it("allows application natural-size updates for non-resizable normal windows", () => {
    const state = createWindowManagerState([{ ...windows[0], isResizable: false }], workArea);
    const fittedBounds = { x: 120, y: 90, width: 463, height: 282 };
    const fitted = windowReducer(state, { type: "fitWindowToContent", id: "about", bounds: fittedBounds });

    expect(fitted.windows.find((window) => window.id === "about")?.bounds).toEqual(fittedBounds);
  });

  it("resize does not modify restoreBounds", () => {
    const restoreBounds = { x: 10, y: 20, width: 300, height: 200 };
    const state = createWindowManagerState([{ ...windows[0], restoreBounds }], workArea);
    const resized = windowReducer(state, { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });

    expect(resized.windows.find((window) => window.id === "about")?.restoreBounds).toEqual(restoreBounds);
  });

  it("maximizing after resize saves resized bounds", () => {
    const resized = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });
    const maximized = windowReducer(resized, { type: "maximizeWindow", id: "about" });

    expect(maximized.windows.find((window) => window.id === "about")?.restoreBounds).toEqual(resizedAboutBounds);
  });

  it("restoring after resize and maximize returns to resized bounds", () => {
    const resized = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });
    const maximized = windowReducer(resized, { type: "maximizeWindow", id: "about" });
    const restored = windowReducer(maximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restored.windows.find((window) => window.id === "about")?.bounds).toEqual(resizedAboutBounds);
  });

  it("preserves resized bounds through maximized minimize restore and normal restore", () => {
    const resized = windowReducer(makeState(), { type: "resizeWindow", id: "about", bounds: resizedAboutBounds });
    const maximized = windowReducer(resized, { type: "maximizeWindow", id: "about" });
    const minimized = windowReducer(maximized, { type: "minimizeWindow", id: "about" });
    const restoredMaximized = windowReducer(minimized, { type: "restoreWindow", id: "about" });
    const restoredNormal = windowReducer(restoredMaximized, { type: "restoreMaximizedWindow", id: "about" });

    expect(restoredMaximized.windows.find((window) => window.id === "about")?.state).toBe("maximized");
    expect(restoredNormal.windows.find((window) => window.id === "about")?.bounds).toEqual(resizedAboutBounds);
  });
});
