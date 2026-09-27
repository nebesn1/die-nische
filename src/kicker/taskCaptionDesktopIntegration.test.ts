import { describe, expect, it } from "vitest";
import {
  initialApplicationCascadeState,
  reconcileApplicationCascadeState,
  reserveApplicationCascadeSerial,
} from "../application-runtime/cascadeState";
import { createWindowManagerState, windowReducer } from "../window-manager/windowReducer";
import type { ApplicationId, DesktopWindow, WorkArea } from "../window-manager/types";
import { groupTaskbarWindows, type TaskbarEntry } from "./taskbarModel";
import { selectTaskbarWindows } from "./taskbarWindowSelector";

const workArea: WorkArea = { x: 0, y: 0, width: 960, height: 640, titleBarHeight: 22 };

const window = (
  id: string,
  appId: ApplicationId,
  desktopId: DesktopWindow["desktopId"],
  overrides: Partial<DesktopWindow> = {},
): DesktopWindow => ({
  id,
  appId,
  baseTitle: appId === "kwrite" ? "Untitled - KWrite" : appId,
  title: appId === "kwrite" ? "Untitled - KWrite" : appId,
  iconId: appId,
  desktopId,
  bounds: { x: 80, y: 60, width: 420, height: 280 },
  zIndex: 1,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 240,
  minimumHeight: 160,
  isResizable: true,
  ...overrides,
});

const getGroup = (entries: readonly TaskbarEntry[]) => {
  const group = entries.find((entry): entry is Extract<TaskbarEntry, { readonly type: "group" }> => entry.type === "group");

  if (!group) {
    throw new Error("Expected a task group");
  }

  return group;
};

describe("Task, caption, focus, and desktop integration", () => {
  it("keeps global captions intact when current-desktop task projection is non-contiguous", () => {
    const state = createWindowManagerState([
      window("app:kwrite", "kwrite", 1, { isActive: true, zIndex: 3 }),
      window("app:kwrite::2", "kwrite", 2, { zIndex: 2 }),
      window("app:kwrite::3", "kwrite", 1, { zIndex: 1 }),
    ], workArea);
    const currentOnly = getGroup(groupTaskbarWindows(
      selectTaskbarWindows(state.windows, 1, false),
      state.lastActiveWindowIdByDesktop[1],
      1,
    ));
    const allDesktops = getGroup(groupTaskbarWindows(
      selectTaskbarWindows(state.windows, 1, true),
      state.lastActiveWindowIdByDesktop[1],
      1,
    ));

    expect(state.windows.map((desktopWindow) => desktopWindow.title)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
      "Untitled - KWrite<3>",
    ]);
    expect(currentOnly.windows.map((desktopWindow) => [desktopWindow.id, desktopWindow.title])).toEqual([
      ["app:kwrite", "Untitled - KWrite"],
      ["app:kwrite::3", "Untitled - KWrite<3>"],
    ]);
    expect(allDesktops.windows.map((desktopWindow) => desktopWindow.id)).toEqual([
      "app:kwrite",
      "app:kwrite::2",
      "app:kwrite::3",
    ]);
    expect(currentOnly.representativeWindowId).toBe("app:kwrite");
  });

  it("focuses and restores the exact off-desktop minimized task member without changing captions or bounds", () => {
    const target = window("app:kcalc", "kcalc", 1, {
      baseTitle: "KCalc",
      title: "KCalc",
      state: "minimized",
      stateBeforeMinimize: "normal",
      bounds: { x: 160, y: 110, width: 320, height: 420 },
    });
    const sibling = window("app:kcalc::2", "kcalc", 1, { baseTitle: "KCalc", title: "KCalc", zIndex: 2 });
    const current = window("app:kcalc::3", "kcalc", 2, { baseTitle: "KCalc", title: "KCalc", isActive: true, zIndex: 3 });
    const state = createWindowManagerState([target, sibling, current], workArea, 2);
    const focused = windowReducer(state, { type: "focusWindow", id: target.id });
    const focusedTarget = focused.windows.find((desktopWindow) => desktopWindow.id === target.id);

    expect(focused.currentDesktopId).toBe(1);
    expect(focusedTarget).toMatchObject({ id: target.id, state: "normal", isActive: true, bounds: target.bounds });
    expect(focusedTarget?.focusRequestId).toBeGreaterThan(target.focusRequestId ?? 0);
    expect(focused.windows.find((desktopWindow) => desktopWindow.id === sibling.id)?.isActive).toBe(false);
    expect(focused.windows.find((desktopWindow) => desktopWindow.id === current.id)?.isActive).toBe(false);
    expect(focused.windows.map((desktopWindow) => desktopWindow.title)).toEqual(["KCalc", "KCalc<2>", "KCalc<3>"]);
  });

  it("reindexes captions live while current-desktop task groups transition to an ordinary task", () => {
    const state = createWindowManagerState([
      window("app:kwrite", "kwrite", 1, { isActive: true, zIndex: 3 }),
      window("app:kwrite::2", "kwrite", 1, { zIndex: 2 }),
      window("app:kwrite::3", "kwrite", 2, { zIndex: 1 }),
    ], workArea);
    const closed = windowReducer(state, { type: "closeWindow", id: "app:kwrite" });
    const currentTasks = groupTaskbarWindows(
      selectTaskbarWindows(closed.windows, 1, false),
      closed.lastActiveWindowIdByDesktop[1],
      1,
    );
    const allTasks = getGroup(groupTaskbarWindows(
      selectTaskbarWindows(closed.windows, 1, true),
      closed.lastActiveWindowIdByDesktop[1],
      1,
    ));

    expect(closed.windows.map((desktopWindow) => desktopWindow.title)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
    ]);
    expect(currentTasks).toMatchObject([{ type: "window", window: { id: "app:kwrite::2", title: "Untitled - KWrite" } }]);
    expect(allTasks.windows.map((desktopWindow) => desktopWindow.title)).toEqual([
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
    ]);
    expect(closed.windows.find((desktopWindow) => desktopWindow.id === "app:kwrite::2")?.isActive).toBe(true);
  });

  it("moves exact task members between desktop projections without changing identity, caption, or bounds", () => {
    const moved = window("app:konsole::2", "konsole", 1, { baseTitle: "Konsole", title: "Konsole", bounds: { x: 144, y: 92, width: 700, height: 460 } });
    const state = createWindowManagerState([
      window("app:konsole", "konsole", 1, { baseTitle: "Konsole", title: "Konsole", isActive: true, zIndex: 3 }),
      moved,
      window("app:konsole::3", "konsole", 2, { baseTitle: "Konsole", title: "Konsole", zIndex: 1 }),
    ], workArea);
    const movedState = windowReducer(state, { type: "moveWindowToDesktop", id: moved.id, desktopId: 2 });
    const sourceTasks = groupTaskbarWindows(selectTaskbarWindows(movedState.windows, 1, false), movedState.lastActiveWindowIdByDesktop[1], 1);
    const targetTasks = getGroup(groupTaskbarWindows(selectTaskbarWindows(movedState.windows, 2, false), movedState.lastActiveWindowIdByDesktop[2], 2));
    const allIds = selectTaskbarWindows(movedState.windows, 1, true).map((desktopWindow) => desktopWindow.id);

    expect(movedState.windows.find((desktopWindow) => desktopWindow.id === moved.id)).toMatchObject({
      desktopId: 2,
      bounds: moved.bounds,
      title: "Konsole<2>",
    });
    expect(sourceTasks).toMatchObject([{ type: "window", window: { id: "app:konsole" } }]);
    expect(targetTasks.windows.map((desktopWindow) => desktopWindow.id)).toEqual(["app:konsole::2", "app:konsole::3"]);
    expect(allIds).toEqual(["app:konsole", "app:konsole::2", "app:konsole::3"]);
  });

  it("keeps Show Desktop identity distinct from minimized state and leaves task actions outside cascade allocation", () => {
    const initial = createWindowManagerState([
      window("app:kfind", "kfind", 1, { baseTitle: "Find Files/Folders", title: "Find Files/Folders", isActive: true, zIndex: 2 }),
      window("app:kfind::2", "kfind", 1, { baseTitle: "Find Files/Folders", title: "Find Files/Folders", zIndex: 1 }),
    ], workArea);
    const shown = windowReducer(initial, { type: "toggleShowDesktop", desktopId: 1 });
    const restored = windowReducer(shown, { type: "toggleShowDesktop", desktopId: 1 });
    const firstCascade = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "kfind");
    const nextCascade = reserveApplicationCascadeSerial(
      reconcileApplicationCascadeState(firstCascade.state, restored.windows),
      1,
      "kfind",
    );

    expect(shown.showDesktopSessionByDesktop[1]?.windowIds).toEqual(["app:kfind", "app:kfind::2"]);
    expect(shown.windows.map((desktopWindow) => desktopWindow.state)).toEqual(["normal", "normal"]);
    expect(restored.windows.map((desktopWindow) => desktopWindow.id)).toEqual(["app:kfind", "app:kfind::2"]);
    expect(nextCascade.serial).toBe(2);
  });

  it("keeps exact task identities generic for all five production multiple applications and resets session state", () => {
    for (const appId of ["konqueror", "kfind", "kwrite", "konsole", "kcalc"] as const) {
      const state = createWindowManagerState([
        window(`app:${appId}`, appId, 1, { isActive: true, zIndex: 2 }),
        window(`app:${appId}::2`, appId, 1, { zIndex: 1 }),
      ], workArea);
      const group = getGroup(groupTaskbarWindows(state.windows, state.lastActiveWindowIdByDesktop[1], 1));

      expect(group.windows.map((desktopWindow) => desktopWindow.id)).toEqual([`app:${appId}`, `app:${appId}::2`]);
      expect(group.representativeWindowId).toBe(`app:${appId}`);
    }

    const reset = windowReducer(createWindowManagerState([
      window("app:kcalc", "kcalc", 1, { isActive: true }),
    ], workArea), { type: "resetSession" });

    expect(reset.windows).toEqual([]);
    expect(reset.lastActiveWindowIdByDesktop).toEqual({ 1: null, 2: null, 3: null, 4: null });
  });
});
