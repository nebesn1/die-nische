import { describe, expect, it } from "vitest";
import { getTaskWindowPresentation } from "./taskWindowPresentation";

describe("task window presentation", () => {
  it("derives running presentation from a visible window state", () => {
    expect(getTaskWindowPresentation({ state: "normal" })).toEqual({
      isMinimized: false,
      iconState: "running",
    });
    expect(getTaskWindowPresentation({ state: "maximized" })).toEqual({
      isMinimized: false,
      iconState: "running",
    });
  });

  it("derives minimized icon and text presentation from the same window state", () => {
    expect(getTaskWindowPresentation({ state: "minimized" })).toEqual({
      isMinimized: true,
      iconState: "minimized",
    });
  });

  it("ignores application, desktop, and active-window identity for visible task presentation", () => {
    const windows = [
      { appId: "konqueror", desktopId: 1, isActive: true, state: "normal" },
      { appId: "konqueror", desktopId: 2, isActive: false, state: "normal" },
      { appId: "another-app", desktopId: 3, isActive: false, state: "maximized" },
      { appId: "konqueror", desktopId: 4, isActive: false, state: "normal" },
    ] as const;

    expect(windows.map(getTaskWindowPresentation)).toEqual([
      { isMinimized: false, iconState: "running" },
      { isMinimized: false, iconState: "running" },
      { isMinimized: false, iconState: "running" },
      { isMinimized: false, iconState: "running" },
    ]);
  });
});
