import { describe, expect, it } from "vitest";
import {
  desktopIconSelectionReducer,
  getAdjacentDesktopIconId,
  initialDesktopIconSelectionState,
} from "./desktopIconState";

const iconIds = ["desktop-trash", "desktop-my-computer", "desktop-blog", "desktop-about-die-nische"] as const;

describe("desktopIconSelectionReducer", () => {
  it("starts with no selected icon", () => {
    expect(initialDesktopIconSelectionState.selectedIconId).toBeNull();
  });

  it("selects My Computer", () => {
    const state = desktopIconSelectionReducer(initialDesktopIconSelectionState, {
      type: "select",
      iconId: "desktop-my-computer",
    });

    expect(state.selectedIconId).toBe("desktop-my-computer");
  });

  it("replaces Trash with My Computer and clears it deterministically", () => {
    const trash = desktopIconSelectionReducer(initialDesktopIconSelectionState, {
      type: "select",
      iconId: "desktop-trash",
    });
    const computer = desktopIconSelectionReducer(trash, {
      type: "select",
      iconId: "desktop-my-computer",
    });

    expect(computer.selectedIconId).toBe("desktop-my-computer");
    expect(desktopIconSelectionReducer(computer, { type: "clear" }).selectedIconId).toBeNull();
  });

  it("keeps repeated selection stable and ignores removed icon ids", () => {
    const selected = desktopIconSelectionReducer(initialDesktopIconSelectionState, {
      type: "select",
      iconId: "desktop-my-computer",
    });

    expect(desktopIconSelectionReducer(selected, { type: "select", iconId: "desktop-my-computer" })).toBe(selected);
    expect(desktopIconSelectionReducer(initialDesktopIconSelectionState, { type: "select", iconId: "desktop-home" })).toBe(initialDesktopIconSelectionState);
  });
});

describe("desktop icon keyboard navigation", () => {
  it("uses the rendered Trash, My Computer, Blog, then About ordering", () => {
    expect(getAdjacentDesktopIconId(iconIds, "desktop-trash", "next")).toBe("desktop-my-computer");
    expect(getAdjacentDesktopIconId(iconIds, "desktop-my-computer", "previous")).toBe("desktop-trash");
    expect(getAdjacentDesktopIconId(iconIds, "desktop-my-computer", "next")).toBe("desktop-blog");
    expect(getAdjacentDesktopIconId(iconIds, "desktop-blog", "next")).toBe("desktop-about-die-nische");
  });

  it("cycles at the four-icon boundaries and handles an empty list", () => {
    expect(getAdjacentDesktopIconId(iconIds, "desktop-about-die-nische", "next")).toBe("desktop-trash");
    expect(getAdjacentDesktopIconId(iconIds, "desktop-trash", "previous")).toBe("desktop-about-die-nische");
    expect(getAdjacentDesktopIconId([], null, "next")).toBeNull();
  });
});
