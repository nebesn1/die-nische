import type { ScreenArea } from "../window-manager/types";

export type ApplicationMenuPopupPosition = {
  readonly left: number;
  readonly top: number;
};

type MenuTriggerRect = {
  readonly left: number;
  readonly bottom: number;
};

/** Positions an application dropdown under its trigger while keeping it on screen. */
export function getApplicationMenuPopupPosition(
  trigger: MenuTriggerRect,
  popup: { readonly width: number; readonly height: number },
  bounds: ScreenArea,
): ApplicationMenuPopupPosition {
  const maximumLeft = Math.max(bounds.x, bounds.x + bounds.width - popup.width);
  const maximumTop = Math.max(bounds.y, bounds.y + bounds.height - popup.height);

  return {
    left: Math.min(Math.max(bounds.x, trigger.left), maximumLeft),
    top: Math.min(Math.max(bounds.y, trigger.bottom - 1), maximumTop),
  };
}
