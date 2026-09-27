import { describe, expect, it } from "vitest";
import { getTaskGroupPopupLeft, getTaskGroupPopupPosition } from "./taskGroupPopupPosition";

const screenArea = { x: 0, y: 0, width: 900, height: 686 };

describe("Task group popup horizontal positioning", () => {
  it("anchors above the group button and clamps only at screen edges", () => {
    expect(getTaskGroupPopupLeft(120, 320, screenArea)).toBe(120);
    expect(getTaskGroupPopupLeft(-20, 320, screenArea)).toBe(4);
    expect(getTaskGroupPopupLeft(800, 320, screenArea)).toBe(576);
  });

  it("uses the available screen width when the panel is narrower than its preferred popup", () => {
    const narrowScreenArea = { ...screenArea, width: 260 };

    expect(getTaskGroupPopupLeft(20, 252, narrowScreenArea)).toBe(4);
  });

  it("anchors each Kicker row to its own button top instead of the Kicker top", () => {
    const firstRow = getTaskGroupPopupPosition({ left: 120, top: 642 }, 320, screenArea);
    const secondRow = getTaskGroupPopupPosition({ left: 120, top: 664 }, 320, screenArea);

    expect(firstRow).toMatchObject({ left: 120, top: 642, maxHeight: 642 });
    expect(secondRow).toMatchObject({ left: 120, top: 664, maxHeight: 664 });
    expect(secondRow.top).toBeGreaterThan(firstRow.top);
  });
});
