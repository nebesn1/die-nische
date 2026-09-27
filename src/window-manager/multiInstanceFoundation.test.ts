import { describe, expect, it } from "vitest";
import { createWindowManagerState, windowReducer } from "./windowReducer";
import type { DesktopWindow, WorkArea } from "./types";

const workArea: WorkArea = { x: 0, y: 0, width: 960, height: 640, titleBarHeight: 22 };

const makeWindow = (id: string, overrides: Partial<DesktopWindow> = {}): DesktopWindow => ({
  id,
  appId: "test-multiple",
  title: "Untitled - Test",
  iconId: "konqueror",
  desktopId: 1,
  bounds: { x: 40, y: 40, width: 420, height: 280 },
  zIndex: id.endsWith("::2") ? 30 : 20,
  isActive: id.endsWith("::2"),
  focusRequestId: 1,
  state: "normal",
  isDraggable: true,
  minimumWidth: 240,
  minimumHeight: 160,
  isResizable: true,
  ...overrides,
});

describe("WindowManager same-application instance foundation", () => {
  it("isolates title and focus updates by WindowId rather than application identity", () => {
    const first = makeWindow("app:test-multiple", { title: "Documents - Test", isActive: true, zIndex: 30 });
    const second = makeWindow("app:test-multiple::2", { title: "Downloads - Test", isActive: false, zIndex: 20 });
    const state = createWindowManagerState([first, second], workArea);
    const titled = windowReducer(state, { type: "setWindowTitle", id: second.id, title: "Trash - Test" });
    const focused = windowReducer(titled, { type: "activateWindow", id: second.id });

    expect(titled.windows.find((window) => window.id === first.id)?.title).toBe("Documents - Test");
    expect(titled.windows.find((window) => window.id === second.id)?.title).toBe("Trash - Test");
    expect(focused.windows.find((window) => window.id === first.id)?.focusRequestId).toBe(first.focusRequestId);
    expect(focused.windows.find((window) => window.id === second.id)?.focusRequestId).toBeGreaterThan(second.focusRequestId ?? 0);
    expect(focused.windows.filter((window) => window.isActive).map((window) => window.id)).toEqual([second.id]);
  });

  it("keeps bounds, desktop assignment, and close cleanup independent for matching app ids", () => {
    const first = makeWindow("app:test-multiple", { bounds: { x: 10, y: 20, width: 400, height: 260 } });
    const second = makeWindow("app:test-multiple::2", { bounds: { x: 100, y: 120, width: 430, height: 300 } });
    const state = createWindowManagerState([first, second], workArea);
    const moved = windowReducer(state, { type: "moveWindowToDesktop", id: second.id, desktopId: 3 });
    const closed = windowReducer(moved, { type: "closeWindow", id: second.id });

    expect(moved.windows.find((window) => window.id === first.id)?.desktopId).toBe(1);
    expect(moved.windows.find((window) => window.id === second.id)?.desktopId).toBe(3);
    expect(moved.windows.find((window) => window.id === first.id)?.bounds).toEqual(first.bounds);
    expect(closed.windows.map((window) => window.id)).toEqual([first.id]);
    expect(closed.windows[0]?.title).toBe(first.title);
  });

  it("targets a same-application instance across virtual desktops without selecting its sibling", () => {
    const first = makeWindow("app:test-multiple", { desktopId: 1, isActive: true, zIndex: 30 });
    const second = makeWindow("app:test-multiple::2", { desktopId: 3, isActive: false, zIndex: 20 });
    const state = createWindowManagerState([first, second], workArea);
    const focused = windowReducer(state, { type: "focusWindow", id: second.id });

    expect(focused.currentDesktopId).toBe(3);
    expect(focused.windows.find((window) => window.id === second.id)?.isActive).toBe(true);
    expect(focused.windows.find((window) => window.id === first.id)?.isActive).toBe(false);
    expect(focused.lastActiveWindowIdByDesktop[3]).toBe(second.id);
  });

  it("keeps matching application windows distinct through Show Desktop and restore", () => {
    const first = makeWindow("app:test-multiple", { isActive: true, zIndex: 30 });
    const second = makeWindow("app:test-multiple::2", { isActive: false, zIndex: 20 });
    const state = createWindowManagerState([first, second], workArea);
    const shown = windowReducer(state, { type: "toggleShowDesktop", desktopId: 1 });
    const restored = windowReducer(shown, { type: "toggleShowDesktop", desktopId: 1 });

    expect(shown.showDesktopSessionByDesktop[1]?.windowIds).toEqual([first.id, second.id]);
    expect(restored.windows.map((window) => window.id)).toEqual([first.id, second.id]);
    expect(restored.windows.find((window) => window.id === first.id)?.isActive).toBe(true);
  });

  it("keeps generic caption ranks across desktop, minimize, Show Desktop, and desktop moves", () => {
    const first = makeWindow("app:future", {
      appId: "future",
      baseTitle: "Shared Caption",
      title: "Shared Caption",
      desktopId: 1,
      isActive: true,
      zIndex: 30,
    });
    const second = makeWindow("app:future::12", {
      appId: "future",
      baseTitle: "Shared Caption",
      title: "Shared Caption",
      desktopId: 2,
      zIndex: 20,
    });
    const state = createWindowManagerState([first, second], workArea);
    const minimized = windowReducer(state, { type: "minimizeWindow", id: first.id });
    const shown = windowReducer(minimized, { type: "toggleShowDesktop", desktopId: 2 });
    const moved = windowReducer(shown, { type: "moveWindowToDesktop", id: second.id, desktopId: 3 });

    for (const current of [state, minimized, shown, moved]) {
      expect(current.windows.map((window) => window.title)).toEqual(["Shared Caption", "Shared Caption<2>"]);
    }
  });

  it("uses the same generic foundation for synthetic future KFind and KWrite windows", () => {
    const kfindFirst = makeWindow("app:kfind", { appId: "kfind", baseTitle: "Find Files/Folders", title: "Find Files/Folders" });
    const kfindSecond = makeWindow("app:kfind::7", { appId: "kfind", baseTitle: "Find Files/Folders", title: "Find Files/Folders" });
    const kwriteFirst = makeWindow("app:kwrite", { appId: "kwrite", baseTitle: "Untitled - KWrite", title: "Untitled - KWrite" });
    const kwriteSecond = makeWindow("app:kwrite::12", { appId: "kwrite", baseTitle: "Untitled - KWrite", title: "Untitled - KWrite" });
    const state = createWindowManagerState([kfindFirst, kfindSecond, kwriteFirst, kwriteSecond], workArea);

    expect(state.windows.map((window) => window.title)).toEqual([
      "Find Files/Folders",
      "Find Files/Folders<2>",
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
    ]);
  });
});
