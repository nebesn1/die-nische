import type { ScreenArea } from "../../window-manager/types";

export type ClockContextMenuState = {
  readonly requestId: number;
  readonly clientX: number;
  readonly clientY: number;
};

export type ClockContextMenuPosition = {
  readonly left: number;
  readonly top: number;
};

export function getClockContextMenuPosition(
  request: Pick<ClockContextMenuState, "clientX" | "clientY">,
  popup: { readonly width: number; readonly height: number },
  bounds: ScreenArea,
): ClockContextMenuPosition {
  const rightEdge = bounds.x + bounds.width;
  const bottomEdge = bounds.y + bounds.height;
  const maximumLeft = Math.max(bounds.x, rightEdge - Math.max(0, popup.width));
  const maximumTop = Math.max(bounds.y, bottomEdge - Math.max(0, popup.height));
  const preferredTop = request.clientY - popup.height - 2;

  return {
    left: Math.round(Math.min(Math.max(request.clientX, bounds.x), maximumLeft)),
    top: Math.round(Math.min(Math.max(preferredTop, bounds.y), maximumTop)),
  };
}
