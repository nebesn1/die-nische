import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "../../application-runtime/applicationRegistry";
import { launchApplicationInState } from "../../application-runtime/launchApplication";
import { createWindowManagerState, windowReducer } from "../../window-manager/windowReducer";
import type { WorkArea } from "../../window-manager/types";

const workArea: WorkArea = { x: 0, y: 0, width: 1024, height: 722, titleBarHeight: 22 };

describe("Bookmark Editor application runtime", () => {
  it("uses the shared singleton lifecycle for launch, restore, cross-desktop focus, and close", () => {
    const first = launchApplicationInState(createWindowManagerState([], workArea, 2), "bookmark-editor");
    const editor = first.state.windows.find((window) => window.appId === "bookmark-editor");
    if (!editor) throw new Error("Bookmark Editor window missing");
    expect(first.result).toBe("opened");
    expect(editor.id).toBe("app:bookmark-editor");

    const duplicate = launchApplicationInState(first.state, "bookmark-editor");
    expect(duplicate.result).toBe("already-active");
    expect(duplicate.state.windows.filter((window) => window.appId === "bookmark-editor")).toHaveLength(1);

    const minimized = windowReducer(first.state, { type: "minimizeWindow", id: editor.id });
    expect(launchApplicationInState(minimized, "bookmark-editor").result).toBe("restored");

    const desktopOne = windowReducer(first.state, { type: "switchDesktop", desktopId: 1 });
    const focused = launchApplicationInState(desktopOne, "bookmark-editor");
    expect(focused.result).toBe("switched-desktop-and-activated");
    expect(focused.state.currentDesktopId).toBe(2);

    const closed = windowReducer(first.state, { type: "closeWindow", id: editor.id });
    expect(launchApplicationInState(closed, "bookmark-editor").result).toBe("opened");
    expect(getApplicationDefinition("bookmark-editor")?.instancePolicy).toBe("singleton");
  });
});
