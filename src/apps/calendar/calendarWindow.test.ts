import { describe, expect, it } from "vitest";
import { CALENDAR_WINDOW_SIZE, getClockAnchoredCalendarBounds } from "./calendarWindow";

const workArea = { x: 0, y: 0, width: 1800, height: 824, titleBarHeight: 22 };

describe("calendar Clock placement", () => {
  it("anchors the new Calendar bottom-right to the Clock top-right", () => {
    expect(getClockAnchoredCalendarBounds({ right: 1700, top: 805 }, workArea)).toEqual({
      x: 1700 - CALENDAR_WINDOW_SIZE.width,
      y: 805 - CALENDAR_WINDOW_SIZE.height,
      ...CALENDAR_WINDOW_SIZE,
    });
  });

  it("clamps the preferred anchor into a constrained work area", () => {
    expect(getClockAnchoredCalendarBounds({ right: 70, top: 80 }, { ...workArea, width: 260, height: 180 })).toEqual({
      x: 0,
      y: 0,
      ...CALENDAR_WINDOW_SIZE,
    });
  });

  it("keeps the complete Calendar inside the right edge when the Clock anchor overflows", () => {
    const bounds = getClockAnchoredCalendarBounds({ right: 2_000, top: 805 }, workArea);

    expect(bounds.x + bounds.width).toBe(workArea.x + workArea.width);
    expect(bounds.y + bounds.height).toBe(805);
  });
});
