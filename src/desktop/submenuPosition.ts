import type { ScreenArea } from "../window-manager/types";

export type SubmenuPosition = {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
  readonly opensLeft: boolean;
};

type TriggerRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
};

type PopupSize = {
  readonly width: number;
  readonly height: number;
};

/** Positions a cascading menu within the visible work area. */
export function getSubmenuPosition(
  trigger: TriggerRect,
  popup: PopupSize,
  bounds: ScreenArea,
): SubmenuPosition {
  const rightEdge = bounds.x + bounds.width;
  const bottomEdge = bounds.y + bounds.height;
  const visibleHeight = Math.min(Math.max(0, popup.height), Math.max(0, bounds.height));
  const maximumLeft = Math.max(bounds.x, rightEdge - popup.width);
  const maximumTop = Math.max(bounds.y, bottomEdge - visibleHeight);
  const preferredRight = trigger.right - 1;
  const opensLeft = preferredRight + popup.width > rightEdge;
  const preferredLeft = opensLeft ? trigger.left - popup.width + 1 : preferredRight;

  return {
    left: Math.min(Math.max(bounds.x, preferredLeft), maximumLeft),
    top: Math.min(Math.max(bounds.y, trigger.top), maximumTop),
    maxHeight: Math.max(0, bounds.height),
    opensLeft,
  };
}
