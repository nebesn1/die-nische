import { clampWindowBounds } from "../../window-manager/geometry";
import type { WindowBounds, WorkArea } from "../../window-manager/types";

export const CALENDAR_WINDOW_SIZE = Object.freeze({ width: 304, height: 218 });

export type ClockAnchorRect = Pick<DOMRect, "right" | "top">;

/** The initial Calendar bottom-right corner meets the Clock top-right corner. */
export function getClockAnchoredCalendarBounds(
  clockRect: ClockAnchorRect,
  workArea: WorkArea,
): WindowBounds {
  return clampWindowBounds({
    x: clockRect.right - CALENDAR_WINDOW_SIZE.width,
    y: clockRect.top - CALENDAR_WINDOW_SIZE.height,
    ...CALENDAR_WINDOW_SIZE,
  }, workArea);
}
