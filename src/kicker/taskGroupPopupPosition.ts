import type { ScreenArea } from "../window-manager/types";

type TaskGroupAnchorRect = {
  readonly left: number;
  readonly top: number;
};

export type TaskGroupPopupPosition = {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
};

export function getTaskGroupPopupLeft(
  anchorLeft: number,
  popupWidth: number,
  screenArea: Pick<ScreenArea, "x" | "width">,
): number {
  const minimum = screenArea.x + 4;
  const maximum = Math.max(minimum, screenArea.x + screenArea.width - popupWidth - 4);

  return Math.min(Math.max(anchorLeft, minimum), maximum);
}

/** Anchors the popup's bottom edge to the exact TaskGroupButton top edge. */
export function getTaskGroupPopupPosition(
  anchorRect: TaskGroupAnchorRect,
  popupWidth: number,
  screenArea: ScreenArea,
): TaskGroupPopupPosition {
  return {
    left: getTaskGroupPopupLeft(anchorRect.left, popupWidth, screenArea),
    top: anchorRect.top,
    maxHeight: Math.max(0, anchorRect.top - screenArea.y),
  };
}
