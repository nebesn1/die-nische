import { describe, expect, it } from "vitest";
import {
  createEmptyLastActiveWindowRecord,
  createEmptyShowDesktopSessionRecord,
  createWindowManagerState,
  windowReducer,
  type WindowManagerState,
} from "./windowReducer";
import { DEFAULT_DESKTOP_ID, getDesktopIds, type DesktopId, type DesktopWindow, type WorkArea } from "./types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};

const makeWindow = (overrides: Partial<DesktopWindow> & Pick<DesktopWindow, "id">): DesktopWindow => ({
  appId: overrides.id,
  title: overrides.id,
  iconId: "about",
  desktopId: 1,
  bounds: { x: 100, y: 100, width: 320, height: 220 },
  zIndex: 10,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
  ...overrides,
});

const initialWindows: readonly DesktopWindow[] = [
  makeWindow({ id: "about", appId: "about", desktopId: 1, zIndex: 20 }),
  makeWindow({ id: "konqueror", appId: "konqueror", desktopId: 1, zIndex: 30, isActive: true }),
];

const makeState = (
  windows: readonly DesktopWindow[] = initialWindows,
  currentDesktopId: DesktopId = DEFAULT_DESKTOP_ID,
): WindowManagerState => createWindowManagerState(windows, workArea, currentDesktopId);

const activeWindows = (state: WindowManagerState): DesktopWindow[] =>
  state.windows.filter((window) => window.isActive);

describe("virtual desktop window state", () => {
  it("derives contiguous desktop ids from the configured count", () => {
    expect(getDesktopIds(4)).toEqual([1, 2, 3, 4]);
    expect(getDesktopIds(5)).toEqual([1, 2, 3, 4, 5]);
    expect(getDesktopIds(20)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(getDesktopIds(21)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });

  it("normalizes an oversized runtime count and clamps active windows to desktop 20", () => {
    const state = createWindowManagerState([
      makeWindow({ id: "desktop-20", desktopId: 20, zIndex: 10 }),
      makeWindow({ id: "desktop-25", desktopId: 25, zIndex: 20, isActive: true }),
    ], workArea, 25, 25);

    expect(state.desktopCount).toBe(20);
    expect(state.currentDesktopId).toBe(20);
    expect(state.windows.map((window) => window.desktopId)).toEqual([20, 20]);
    expect(Object.keys(state.lastActiveWindowIdByDesktop)).toHaveLength(20);
  });

  it("clamps a runtime desktop-count increase to the supported maximum", () => {
    const state = windowReducer(makeState(), { type: "setDesktopCount", desktopCount: 25 });

    expect(state.desktopCount).toBe(20);
    expect(Object.keys(state.showDesktopSessionByDesktop)).toHaveLength(20);
  });

  it("initializes desktop 1 with Konqueror as last active", () => {
    const state = makeState();

    expect(state.currentDesktopId).toBe(1);
    expect(state.windows.find((window) => window.id === "about")?.desktopId).toBe(1);
    expect(state.windows.find((window) => window.id === "konqueror")?.desktopId).toBe(1);
    expect(state.lastActiveWindowIdByDesktop).toEqual({
      1: "konqueror",
      2: null,
      3: null,
      4: null,
    });
  });

  it("atomically clamps the active desktop and migrates removed-desktop windows on shrink", () => {
    const state = makeState([
      makeWindow({ id: "desktop-1", desktopId: 1, zIndex: 10 }),
      makeWindow({ id: "desktop-2", desktopId: 2, zIndex: 20 }),
      makeWindow({ id: "desktop-3", desktopId: 3, zIndex: 30 }),
      makeWindow({ id: "desktop-4", desktopId: 4, zIndex: 40, isActive: true }),
    ], 4);
    const shrunk = windowReducer(state, { type: "setDesktopCount", desktopCount: 2 });

    expect(shrunk.desktopCount).toBe(2);
    expect(shrunk.currentDesktopId).toBe(2);
    expect(Object.fromEntries(shrunk.windows.map((window) => [window.id, window.desktopId]))).toEqual({
      "desktop-1": 1,
      "desktop-2": 2,
      "desktop-3": 2,
      "desktop-4": 2,
    });
    expect(Object.keys(shrunk.lastActiveWindowIdByDesktop)).toEqual(["1", "2"]);
    expect(Object.keys(shrunk.showDesktopSessionByDesktop)).toEqual(["1", "2"]);
    expect(shrunk.windows.every((window) => window.desktopId <= 2)).toBe(true);
  });

  it("migrates every ordinary window to desktop 1 when reducing to one desktop", () => {
    const state = makeState([
      makeWindow({ id: "one", desktopId: 1 }),
      makeWindow({ id: "two", desktopId: 2 }),
      makeWindow({ id: "three", desktopId: 3 }),
      makeWindow({ id: "four", desktopId: 4, isActive: true }),
    ], 4);
    const shrunk = windowReducer(state, { type: "setDesktopCount", desktopCount: 1 });

    expect(shrunk.currentDesktopId).toBe(1);
    expect(shrunk.windows.map((window) => window.desktopId)).toEqual([1, 1, 1, 1]);
    expect(Object.keys(shrunk.lastActiveWindowIdByDesktop)).toEqual(["1"]);
  });

  it("keeps existing desktops intact when growing and permits windows on a new desktop", () => {
    const twoDesktops = windowReducer(makeState([
      makeWindow({ id: "one", desktopId: 1 }),
      makeWindow({ id: "two", desktopId: 2 }),
    ]), { type: "setDesktopCount", desktopCount: 2 });
    const grown = windowReducer(twoDesktops, { type: "setDesktopCount", desktopCount: 5 });
    const switched = windowReducer(grown, { type: "switchDesktop", desktopId: 5 });
    const opened = windowReducer(switched, {
      type: "openWindow",
      window: makeWindow({ id: "desktop-5", desktopId: 5 }),
    });

    expect(grown.windows.map((window) => window.desktopId)).toEqual([1, 2]);
    expect(switched.currentDesktopId).toBe(5);
    expect(opened.windows.find((window) => window.id === "desktop-5")?.desktopId).toBe(5);
  });

  it("rejects direct switch, move, and show-desktop requests outside the configured count", () => {
    const state = windowReducer(makeState(), { type: "setDesktopCount", desktopCount: 2 });

    expect(windowReducer(state, { type: "switchDesktop", desktopId: 3 })).toBe(state);
    expect(windowReducer(state, { type: "moveWindowToDesktop", id: "about", desktopId: 3 })).toBe(state);
    expect(windowReducer(state, { type: "toggleShowDesktop", desktopId: 3 })).toBe(state);
  });

  it("switches to an empty desktop without changing window geometry, state, order, or z-index", () => {
    const state = makeState();
    const switched = windowReducer(state, { type: "switchDesktop", desktopId: 2 });

    expect(switched.currentDesktopId).toBe(2);
    expect(activeWindows(switched)).toEqual([]);
    expect(switched.windows.map((window) => window.bounds)).toEqual(state.windows.map((window) => window.bounds));
    expect(switched.windows.map((window) => window.state)).toEqual(state.windows.map((window) => window.state));
    expect(switched.windows.map((window) => window.zIndex)).toEqual(state.windows.map((window) => window.zIndex));
    expect(switched.windows.map((window) => window.id)).toEqual(["about", "konqueror"]);
  });

  it("switching to the current desktop is a no-op", () => {
    const state = makeState();

    expect(windowReducer(state, { type: "switchDesktop", desktopId: 1 })).toBe(state);
  });

  it("restores the target desktop last active window without raising it", () => {
    const state = windowReducer(makeState(), { type: "activateWindow", id: "about" });
    const nextZIndex = state.nextZIndex;
    const switchedAway = windowReducer(state, { type: "switchDesktop", desktopId: 2 });
    const switchedBack = windowReducer(switchedAway, { type: "switchDesktop", desktopId: 1 });

    expect(switchedBack.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(switchedBack.nextZIndex).toBe(nextZIndex);
  });

  it("uses the highest z-index visible window when target last active is invalid or minimized", () => {
    const state = {
      ...makeState(
        [
          ...initialWindows,
          makeWindow({ id: "low", desktopId: 2, zIndex: 40, state: "minimized" }),
          makeWindow({ id: "high", desktopId: 2, zIndex: 50 }),
        ],
        1,
      ),
      lastActiveWindowIdByDesktop: {
        ...createEmptyLastActiveWindowRecord(),
        1: "konqueror",
        2: "low",
      },
    };
    const switched = windowReducer(state, { type: "switchDesktop", desktopId: 2 });

    expect(switched.windows.find((window) => window.id === "high")?.isActive).toBe(true);
    expect(switched.lastActiveWindowIdByDesktop[2]).toBe("high");
  });

  it("allows a desktop with only minimized windows to have no active window", () => {
    const state = makeState([makeWindow({ id: "hidden", desktopId: 2, state: "minimized" })], 1);
    const switched = windowReducer(state, { type: "switchDesktop", desktopId: 2 });

    expect(activeWindows(switched)).toEqual([]);
    expect(switched.lastActiveWindowIdByDesktop[2]).toBeNull();
  });

  it("updates last active only for the current desktop when activating a window", () => {
    const state = {
      ...makeState([...initialWindows, makeWindow({ id: "desk2", desktopId: 2 })]),
      lastActiveWindowIdByDesktop: {
        ...createEmptyLastActiveWindowRecord(),
        1: "konqueror",
        2: "desk2",
      },
    };
    const activated = windowReducer(state, { type: "activateWindow", id: "about" });
    const offDesktopActivation = windowReducer(activated, { type: "activateWindow", id: "desk2" });

    expect(activated.lastActiveWindowIdByDesktop[1]).toBe("about");
    expect(activated.lastActiveWindowIdByDesktop[2]).toBe("desk2");
    expect(offDesktopActivation).toBe(activated);
  });

  it("does not change last active for normal bounds updates", () => {
    const state = makeState();
    const moved = windowReducer(state, { type: "moveWindow", id: "about", x: 120, y: 140 });

    expect(moved.lastActiveWindowIdByDesktop).toEqual(state.lastActiveWindowIdByDesktop);
  });

  it("minimize and close fallback only within the current desktop", () => {
    const state = makeState([
      makeWindow({ id: "desk1-low", desktopId: 1, zIndex: 20 }),
      makeWindow({ id: "desk1-active", desktopId: 1, zIndex: 30, isActive: true }),
      makeWindow({ id: "desk2-high", desktopId: 2, zIndex: 100 }),
    ]);
    const minimized = windowReducer(state, { type: "minimizeWindow", id: "desk1-active" });
    const closed = windowReducer(state, { type: "closeWindow", id: "desk1-active" });

    expect(minimized.windows.find((window) => window.id === "desk1-low")?.isActive).toBe(true);
    expect(minimized.windows.find((window) => window.id === "desk2-high")?.isActive).toBe(false);
    expect(closed.windows.find((window) => window.id === "desk1-low")?.isActive).toBe(true);
    expect(closed.windows.find((window) => window.id === "desk2-high")?.isActive).toBe(false);
  });

  it("closing a non-current desktop last active window does not alter the current active window", () => {
    const state = {
      ...makeState([...initialWindows, makeWindow({ id: "desk2", desktopId: 2, zIndex: 40 })]),
      lastActiveWindowIdByDesktop: {
        ...createEmptyLastActiveWindowRecord(),
        1: "konqueror",
        2: "desk2",
      },
    };
    const closed = windowReducer(state, { type: "closeWindow", id: "desk2" });

    expect(closed.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
    expect(closed.lastActiveWindowIdByDesktop[2]).toBeNull();
  });

  it("opens a new window on its desktop and records it as last active", () => {
    const state = makeState([], 3);
    const opened = windowReducer(state, {
      type: "openWindow",
      window: makeWindow({ id: "new-about", appId: "about", desktopId: 3 }),
    });

    expect(opened.currentDesktopId).toBe(3);
    expect(opened.windows[0]?.desktopId).toBe(3);
    expect(opened.windows[0]?.isActive).toBe(true);
    expect(opened.lastActiveWindowIdByDesktop[3]).toBe("new-about");
  });

  it("focusWindow switches desktops, restores minimized windows, and raises once", () => {
    const state = makeState(
      [
        makeWindow({
          id: "konqueror",
          appId: "konqueror",
          desktopId: 1,
          state: "minimized",
          stateBeforeMinimize: "maximized",
          restoreBounds: { x: 100, y: 100, width: 500, height: 420 },
          zIndex: 30,
        }),
        makeWindow({ id: "desk3", desktopId: 3, zIndex: 40, isActive: true }),
      ],
      3,
    );
    const focused = windowReducer(state, { type: "focusWindow", id: "konqueror" });

    expect(focused.currentDesktopId).toBe(1);
    expect(focused.windows.find((window) => window.id === "konqueror")?.desktopId).toBe(1);
    expect(focused.windows.find((window) => window.id === "konqueror")?.state).toBe("maximized");
    expect(focused.windows.find((window) => window.id === "konqueror")?.zIndex).toBe(state.nextZIndex);
    expect(focused.nextZIndex).toBe(state.nextZIndex + 1);
    expect(activeWindows(focused).map((window) => window.id)).toEqual(["konqueror"]);
  });

  it("preserves window state metadata across desktop switches", () => {
    const restoreBounds = { x: 20, y: 30, width: 400, height: 280 };
    const state = makeState([
      makeWindow({
        id: "konqueror",
        desktopId: 1,
        state: "minimized",
        stateBeforeMinimize: "maximized",
        restoreBounds,
      }),
    ]);
    const switched = windowReducer(windowReducer(state, { type: "switchDesktop", desktopId: 2 }), {
      type: "switchDesktop",
      desktopId: 1,
    });

    expect(switched.windows[0]?.state).toBe("minimized");
    expect(switched.windows[0]?.stateBeforeMinimize).toBe("maximized");
    expect(switched.windows[0]?.restoreBounds).toEqual(restoreBounds);
  });

  it("initializes show desktop sessions as empty for all desktops", () => {
    expect(makeState().showDesktopSessionByDesktop).toEqual({
      1: null,
      2: null,
      3: null,
      4: null,
    });
  });

  it("enters show desktop for current visible windows only", () => {
    const restoreBounds = { x: 20, y: 20, width: 420, height: 300 };
    const state = makeState([
      makeWindow({ id: "normal", desktopId: 1, zIndex: 20 }),
      makeWindow({ id: "maximized", desktopId: 1, zIndex: 30, state: "maximized", restoreBounds, isActive: true }),
      makeWindow({ id: "minimized", desktopId: 1, zIndex: 40, state: "minimized", stateBeforeMinimize: "normal" }),
      makeWindow({ id: "other-desktop", desktopId: 2, zIndex: 50 }),
    ]);
    const shown = windowReducer(state, { type: "toggleShowDesktop", desktopId: 1 });

    expect(shown.showDesktopSessionByDesktop[1]).toEqual({
      windowIds: ["normal", "maximized"],
      previouslyActiveWindowId: "maximized",
    });
    expect(activeWindows(shown)).toEqual([]);
    expect(shown.windows.map((window) => [window.id, window.state, window.bounds, window.zIndex] as const)).toEqual(
      state.windows.map((window) => [window.id, window.state, window.bounds, window.zIndex] as const),
    );
    expect(shown.windows.find((window) => window.id === "maximized")?.restoreBounds).toEqual(restoreBounds);
    expect(shown.windows.find((window) => window.id === "minimized")?.stateBeforeMinimize).toBe("normal");
    expect(shown.showDesktopSessionByDesktop[2]).toBeNull();
  });

  it("does not create a show desktop session without visible windows", () => {
    const state = makeState([makeWindow({ id: "hidden", desktopId: 1, state: "minimized" })]);

    expect(windowReducer(state, { type: "toggleShowDesktop", desktopId: 1 })).toBe(state);
  });

  it("restores show desktop without changing z-index and reactivates the previous active window", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const restored = windowReducer(shown, { type: "toggleShowDesktop", desktopId: 1 });

    expect(restored.showDesktopSessionByDesktop[1]).toBeNull();
    expect(restored.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
    expect(restored.windows.map((window) => window.zIndex)).toEqual(shown.windows.map((window) => window.zIndex));
    expect(restored.nextZIndex).toBe(shown.nextZIndex);
  });

  it("restores show desktop to the highest visible window when the previous active window is gone or minimized", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const closedPrevious = windowReducer(shown, { type: "closeWindow", id: "konqueror" });
    const restoredAfterClose = windowReducer(closedPrevious, { type: "toggleShowDesktop", desktopId: 1 });
    const shownAgain = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const minimizedPrevious = windowReducer(shownAgain, { type: "minimizeWindow", id: "konqueror" });
    const restoredAfterMinimize = windowReducer(minimizedPrevious, { type: "toggleShowDesktop", desktopId: 1 });

    expect(restoredAfterClose.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(restoredAfterMinimize.windows.find((window) => window.id === "about")?.isActive).toBe(true);
  });

  it("keeps show desktop sessions independent across desktops and switchDesktop preserves them", () => {
    const state = makeState([...initialWindows, makeWindow({ id: "desk2", desktopId: 2, zIndex: 40 })]);
    const desktopOneShown = windowReducer(state, { type: "toggleShowDesktop", desktopId: 1 });
    const switched = windowReducer(desktopOneShown, { type: "switchDesktop", desktopId: 2 });
    const desktopTwoShown = windowReducer(switched, { type: "toggleShowDesktop", desktopId: 2 });
    const backToOne = windowReducer(desktopTwoShown, { type: "switchDesktop", desktopId: 1 });

    expect(switched.showDesktopSessionByDesktop[1]?.windowIds).toEqual(["about", "konqueror"]);
    expect(switched.showDesktopSessionByDesktop[2]).toBeNull();
    expect(desktopTwoShown.showDesktopSessionByDesktop[2]?.windowIds).toEqual(["desk2"]);
    expect(backToOne.showDesktopSessionByDesktop[1]).not.toBeNull();
    expect(activeWindows(backToOne)).toEqual([]);
  });

  it("taskbar-style focus exits show desktop and raises the target once", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const focused = windowReducer(shown, { type: "toggleTaskbarWindow", id: "about" });

    expect(focused.showDesktopSessionByDesktop[1]).toBeNull();
    expect(focused.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(focused.windows.find((window) => window.id === "about")?.state).toBe("normal");
    expect(focused.windows.find((window) => window.id === "about")?.zIndex).toBe(shown.nextZIndex);
    expect(focused.nextZIndex).toBe(shown.nextZIndex + 1);
  });

  it("taskbar-style restore exits show desktop and restores a minimized window once", () => {
    const minimized = windowReducer(makeState(), { type: "minimizeWindow", id: "about" });
    const shown = windowReducer(minimized, { type: "toggleShowDesktop", desktopId: 1 });
    const restored = windowReducer(shown, { type: "toggleTaskbarWindow", id: "about" });

    expect(restored.showDesktopSessionByDesktop[1]).toBeNull();
    expect(restored.windows.find((window) => window.id === "about")?.state).toBe("normal");
    expect(restored.windows.find((window) => window.id === "about")?.isActive).toBe(true);
    expect(restored.nextZIndex).toBe(shown.nextZIndex + 1);
  });

  it("open and focus clear the target desktop show desktop session", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const opened = windowReducer(shown, {
      type: "openWindow",
      window: makeWindow({ id: "new-about", appId: "about", desktopId: 1 }),
    });
    const crossDesktopShown = {
      ...makeState([...initialWindows, makeWindow({ id: "desk2", desktopId: 2, zIndex: 50 })], 1),
      showDesktopSessionByDesktop: {
        ...createEmptyShowDesktopSessionRecord(),
        2: {
          windowIds: ["desk2"],
          previouslyActiveWindowId: "desk2",
        },
      },
    };
    const focused = windowReducer(crossDesktopShown, { type: "focusWindow", id: "desk2" });

    expect(opened.showDesktopSessionByDesktop[1]).toBeNull();
    expect(opened.windows.find((window) => window.id === "new-about")?.isActive).toBe(true);
    expect(focused.currentDesktopId).toBe(2);
    expect(focused.showDesktopSessionByDesktop[2]).toBeNull();
    expect(focused.windows.find((window) => window.id === "desk2")?.isActive).toBe(true);
  });

  it("removes closed and minimized windows from show desktop sessions", () => {
    const shown = windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 });
    const minimized = windowReducer(shown, { type: "minimizeWindow", id: "about" });
    const closed = windowReducer(minimized, { type: "closeWindow", id: "konqueror" });

    expect(minimized.showDesktopSessionByDesktop[1]?.windowIds).toEqual(["konqueror"]);
    expect(closed.showDesktopSessionByDesktop[1]).toBeNull();
    expect(closed.currentDesktopId).toBe(1);
  });

  it("never creates two active windows while toggling show desktop", () => {
    const states = [
      windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 }),
      windowReducer(windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 }), {
        type: "toggleShowDesktop",
        desktopId: 1,
      }),
      windowReducer(windowReducer(makeState(), { type: "toggleShowDesktop", desktopId: 1 }), {
        type: "toggleTaskbarWindow",
        id: "about",
      }),
    ];

    states.forEach((state) => {
      expect(activeWindows(state).length).toBeLessThanOrEqual(1);
    });
  });

  it("moves a normal window to another desktop without changing window data or order", () => {
    const state = makeState();
    const moved = windowReducer(state, { type: "moveWindowToDesktop", id: "about", desktopId: 3 });
    const movedWindow = moved.windows.find((window) => window.id === "about");

    expect(movedWindow?.desktopId).toBe(3);
    expect(movedWindow?.bounds).toEqual(state.windows[0]?.bounds);
    expect(movedWindow?.state).toBe("normal");
    expect(movedWindow?.zIndex).toBe(state.windows[0]?.zIndex);
    expect(movedWindow?.restoreBounds).toBeUndefined();
    expect(movedWindow?.stateBeforeMinimize).toBeUndefined();
    expect(moved.windows.map((window) => window.id)).toEqual(state.windows.map((window) => window.id));
    expect(moved.currentDesktopId).toBe(1);
  });

  it("preserves recoverable partial-offscreen normal bounds when moving to another desktop", () => {
    const partial = windowReducer(makeState(), {
      type: "moveWindow",
      id: "about",
      x: -600,
      y: 900,
      screenArea: { x: 0, y: 0, width: 900, height: 686 },
    });
    const moved = windowReducer(partial, { type: "moveWindowToDesktop", id: "about", desktopId: 3 });
    const switched = windowReducer(moved, { type: "switchDesktop", desktopId: 3 });

    expect(switched.windows.find((window) => window.id === "about")?.bounds).toEqual({
      x: -256,
      y: 618,
      width: 320,
      height: 220,
    });
  });

  it("treats moving to the same desktop and unknown windows as no-ops", () => {
    const state = makeState();

    expect(windowReducer(state, { type: "moveWindowToDesktop", id: "about", desktopId: 1 })).toBe(state);
    expect(windowReducer(state, { type: "moveWindowToDesktop", id: "missing", desktopId: 2 })).toBe(state);
  });

  it("falls back to the highest z-index source desktop window after moving the active window", () => {
    const state = makeState([
      makeWindow({ id: "low", desktopId: 1, zIndex: 20 }),
      makeWindow({ id: "high", desktopId: 1, zIndex: 40 }),
      makeWindow({ id: "active", desktopId: 1, zIndex: 50, isActive: true }),
      makeWindow({ id: "other-desktop", desktopId: 2, zIndex: 100 }),
    ]);
    const moved = windowReducer(state, { type: "moveWindowToDesktop", id: "active", desktopId: 3 });

    expect(moved.windows.find((window) => window.id === "active")?.isActive).toBe(false);
    expect(moved.windows.find((window) => window.id === "high")?.isActive).toBe(true);
    expect(moved.windows.find((window) => window.id === "other-desktop")?.isActive).toBe(false);
    expect(moved.lastActiveWindowIdByDesktop[1]).toBe("high");
    expect(moved.lastActiveWindowIdByDesktop[3]).toBe("active");
  });

  it("allows no active window after moving the only visible active window away", () => {
    const state = makeState([makeWindow({ id: "active", desktopId: 1, zIndex: 50, isActive: true })]);
    const moved = windowReducer(state, { type: "moveWindowToDesktop", id: "active", desktopId: 2 });

    expect(activeWindows(moved)).toEqual([]);
    expect(moved.lastActiveWindowIdByDesktop[1]).toBeNull();
    expect(moved.lastActiveWindowIdByDesktop[2]).toBe("active");
  });

  it("moving a non-active window keeps the current active window and z-index stable", () => {
    const state = makeState();
    const moved = windowReducer(state, { type: "moveWindowToDesktop", id: "about", desktopId: 2 });

    expect(moved.windows.find((window) => window.id === "konqueror")?.isActive).toBe(true);
    expect(moved.windows.map((window) => window.zIndex)).toEqual(state.windows.map((window) => window.zIndex));
    expect(moved.nextZIndex).toBe(state.nextZIndex);
  });

  it("does not let minimized windows overwrite a target desktop last active record", () => {
    const state = {
      ...makeState([
        makeWindow({ id: "minimized", desktopId: 1, state: "minimized", stateBeforeMinimize: "normal" }),
        makeWindow({ id: "target-active", desktopId: 2, zIndex: 40 }),
      ]),
      lastActiveWindowIdByDesktop: {
        ...createEmptyLastActiveWindowRecord(),
        1: null,
        2: "target-active",
      },
    };
    const moved = windowReducer(state, { type: "moveWindowToDesktop", id: "minimized", desktopId: 2 });

    expect(moved.windows.find((window) => window.id === "minimized")?.desktopId).toBe(2);
    expect(moved.windows.find((window) => window.id === "minimized")?.state).toBe("minimized");
    expect(moved.lastActiveWindowIdByDesktop[2]).toBe("target-active");
  });

  it("switching to a target desktop activates a moved non-minimized window", () => {
    const moved = windowReducer(makeState(), { type: "moveWindowToDesktop", id: "about", desktopId: 3 });
    const switched = windowReducer(moved, { type: "switchDesktop", desktopId: 3 });

    expect(switched.currentDesktopId).toBe(3);
    expect(switched.windows.find((window) => window.id === "about")?.isActive).toBe(true);
  });

  it("preserves maximized, minimized, restore, and resized bounds metadata while moving", () => {
    const restoreBounds = { x: 40, y: 60, width: 480, height: 300 };
    const resizedBounds = { x: 30, y: 44, width: 540, height: 310 };
    const state = makeState([
      makeWindow({ id: "resized", desktopId: 1, bounds: resizedBounds }),
      makeWindow({ id: "maximized", desktopId: 1, state: "maximized", restoreBounds }),
      makeWindow({ id: "minimized", desktopId: 1, state: "minimized", stateBeforeMinimize: "maximized", restoreBounds }),
    ]);
    const movedResized = windowReducer(state, { type: "moveWindowToDesktop", id: "resized", desktopId: 2 });
    const movedMaximized = windowReducer(state, { type: "moveWindowToDesktop", id: "maximized", desktopId: 2 });
    const movedMinimized = windowReducer(state, { type: "moveWindowToDesktop", id: "minimized", desktopId: 2 });

    expect(movedResized.windows.find((window) => window.id === "resized")?.bounds).toEqual(resizedBounds);
    expect(movedMaximized.windows.find((window) => window.id === "maximized")?.state).toBe("maximized");
    expect(movedMaximized.windows.find((window) => window.id === "maximized")?.restoreBounds).toEqual(restoreBounds);
    expect(movedMinimized.windows.find((window) => window.id === "minimized")?.state).toBe("minimized");
    expect(movedMinimized.windows.find((window) => window.id === "minimized")?.stateBeforeMinimize).toBe("maximized");
  });

  it("updates show desktop sessions when moving between desktops", () => {
    const state = {
      ...makeState([
        makeWindow({ id: "source-hidden", desktopId: 1, zIndex: 20 }),
        makeWindow({ id: "target-visible", desktopId: 2, zIndex: 30 }),
        makeWindow({ id: "minimized", desktopId: 1, state: "minimized", stateBeforeMinimize: "normal" }),
      ]),
      showDesktopSessionByDesktop: {
        ...createEmptyShowDesktopSessionRecord(),
        1: {
          windowIds: ["source-hidden"],
          previouslyActiveWindowId: "source-hidden",
        },
        2: {
          windowIds: ["target-visible"],
          previouslyActiveWindowId: "target-visible",
        },
      },
    };
    const movedVisible = windowReducer(state, {
      type: "moveWindowToDesktop",
      id: "source-hidden",
      desktopId: 2,
    });
    const movedMinimized = windowReducer(state, {
      type: "moveWindowToDesktop",
      id: "minimized",
      desktopId: 2,
    });

    expect(movedVisible.showDesktopSessionByDesktop[1]).toBeNull();
    expect(movedVisible.showDesktopSessionByDesktop[2]).toEqual({
      windowIds: ["target-visible", "source-hidden"],
      previouslyActiveWindowId: "target-visible",
    });
    expect(movedMinimized.showDesktopSessionByDesktop[2]?.windowIds).toEqual(["target-visible"]);
  });

  it("does not create duplicate active windows after move operations", () => {
    const moved = windowReducer(makeState(), { type: "moveWindowToDesktop", id: "konqueror", desktopId: 2 });
    const switched = windowReducer(moved, { type: "switchDesktop", desktopId: 2 });

    expect(activeWindows(moved).length).toBeLessThanOrEqual(1);
    expect(activeWindows(switched).length).toBeLessThanOrEqual(1);
  });
});
