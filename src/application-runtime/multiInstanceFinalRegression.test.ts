import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "./applicationRegistry";
import { getApplicationInstancePolicy } from "./instancePolicy";
import { initialApplicationCascadeState, reconcileApplicationCascadeState, reserveApplicationCascadeSerial } from "./cascadeState";
import { planApplicationLaunch, planNewApplicationInstance, type LaunchApplicationPlan } from "./launchApplication";
import { resolveApplicationInitialBounds } from "./resolveApplicationInitialBounds";
import { groupTaskbarWindows, type TaskbarEntry } from "../kicker/taskbarModel";
import { selectTaskbarWindows } from "../kicker/taskbarWindowSelector";
import { createWindowManagerState, windowReducer, type WindowManagerState } from "../window-manager/windowReducer";
import type { DesktopWindow, WorkArea } from "../window-manager/types";

const workArea: WorkArea = { x: 0, y: 0, width: 1_600, height: 900, titleBarHeight: 22 };
const multipleApplicationIds = ["konqueror", "kfind", "kwrite", "konsole", "kcalc", "article-reader"] as const;
const singletonApplicationIds = ["about-kde", "about-die-nische", "about-konqueror", "about-kcontrol", "about-kde-panel", "about-kwrite", "about-konsole", "about-kcalc", "blog", "blog-archive", "blog-tags", "blog-search", "kcontrol", "configure-panel", "configure-clock"] as const;

const openPlan = (state: WindowManagerState, plan: LaunchApplicationPlan): WindowManagerState => {
  if (plan.action !== "open") {
    throw new Error("Expected a new application window plan");
  }

  return windowReducer(state, { type: "openWindow", window: plan.window });
};

const getGroup = (entries: readonly TaskbarEntry[]) => {
  const group = entries.find((entry): entry is Extract<TaskbarEntry, { readonly type: "group" }> => entry.type === "group");

  if (!group) {
    throw new Error("Expected task group");
  }

  return group;
};

const getWindow = (windows: readonly DesktopWindow[], id: string): DesktopWindow => {
  const desktopWindow = windows.find((window) => window.id === id);

  if (!desktopWindow) {
    throw new Error(`Missing ${id}`);
  }

  return desktopWindow;
};

const makeCascadeWindow = (id: string): DesktopWindow => ({
  id,
  appId: "kwrite",
  baseTitle: "Untitled - KWrite",
  title: "Untitled - KWrite",
  iconId: "kwrite",
  desktopId: 1,
  bounds: { x: 440, y: 170, width: 720, height: 560 },
  zIndex: 1,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 420,
  minimumHeight: 300,
  isResizable: true,
});

describe("final multi-instance Runtime regression matrix", () => {
  it("keeps the intended production policies and singleton boundary", () => {
    for (const appId of multipleApplicationIds) {
      expect(getApplicationInstancePolicy(getApplicationDefinition(appId))).toBe("multiple");
    }

    for (const appId of singletonApplicationIds) {
      expect(getApplicationInstancePolicy(getApplicationDefinition(appId))).toBe("singleton");
    }
  });

  it("creates, groups, reuses, focuses, and closes each production multiple app by exact WindowId", () => {
    for (const appId of multipleApplicationIds) {
      const definition = getApplicationDefinition(appId);
      if (!definition) throw new Error(`${appId} definition is required`);

      const firstPlan = planNewApplicationInstance(appId, [], 1, 1, workArea, undefined, 0);
      const firstState = openPlan(createWindowManagerState([], workArea), firstPlan);
      const secondPlan = planNewApplicationInstance(appId, firstState.windows, firstState.nextZIndex, 1, workArea, undefined, 1);
      const secondState = openPlan(firstState, secondPlan);
      const [first, second] = secondState.windows;

      if (!first || !second) throw new Error(`Expected two ${appId} windows`);

      const ordinaryPlan = planApplicationLaunch(appId, secondState.windows, secondState.nextZIndex, 1, workArea);
      const taskGroup = getGroup(groupTaskbarWindows(
        selectTaskbarWindows(secondState.windows, 1, false),
        secondState.lastActiveWindowIdByDesktop[1],
        1,
      ));
      const focused = windowReducer(secondState, { type: "focusWindow", id: first.id });
      const closed = windowReducer(focused, { type: "closeWindow", id: first.id });

      expect(first.id).not.toBe(second.id);
      expect(first.bounds).toEqual(resolveApplicationInitialBounds(definition, workArea));
      expect(taskGroup.windows.map((window) => window.id)).toEqual([first.id, second.id]);
      expect(ordinaryPlan).toMatchObject({ action: "activate", windowId: first.id });
      expect(getWindow(focused.windows, first.id)).toMatchObject({ isActive: true });
      expect(getWindow(focused.windows, first.id).focusRequestId).toBeGreaterThan(first.focusRequestId ?? 0);
      expect(closed.windows).toHaveLength(1);
      expect(closed.windows[0]?.id).toBe(second.id);
      expect(closed.windows[0]?.title).toBe(definition.defaultTitle);
    }
  });

  it("keeps singleton new-instance requests as exact existing-window actions", () => {
    for (const appId of singletonApplicationIds) {
      const first = planNewApplicationInstance(appId, [], 1, 1, workArea);
      const state = openPlan(createWindowManagerState([], workArea), first);
      const repeat = planNewApplicationInstance(appId, state.windows, state.nextZIndex, 1, workArea);

      expect(repeat).toMatchObject({ action: "activate", windowId: state.windows[0]?.id });
    }
  });

  it("keeps cascade serial lifecycle independent from captions, task actions, and runtime ids", () => {
    const first = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "kwrite");
    const second = reserveApplicationCascadeSerial(first.state, 1, "kwrite");
    const third = reserveApplicationCascadeSerial(second.state, 1, "kwrite");
    const afterMiddleClose = reconcileApplicationCascadeState(third.state, [
      makeCascadeWindow("app:kwrite"),
      { ...makeCascadeWindow("app:kwrite::3"), title: "Untitled - KWrite<2>" },
    ]);
    const fourth = reserveApplicationCascadeSerial(afterMiddleClose, 1, "kwrite");
    const reset = reconcileApplicationCascadeState(fourth.state, []);
    const reopened = reserveApplicationCascadeSerial(reset, 1, "kwrite");

    expect([first.serial, second.serial, third.serial, fourth.serial]).toEqual([0, 1, 2, 3]);
    expect(reopened.serial).toBe(0);
  });
});
