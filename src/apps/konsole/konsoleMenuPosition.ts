import type { ScreenArea } from "../../window-manager/types";

type KonsoleSubmenuTrigger = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
};

export type KonsoleMenuPosition = {
  readonly left: number;
  readonly top: number;
  readonly opensLeft: boolean;
};

/** Places a Konsole submenu beside its row and flips it within the screen area. */
export function getKonsoleSchemaSubmenuPosition(
  trigger: KonsoleSubmenuTrigger,
  submenu: { readonly width: number; readonly height: number },
  bounds: ScreenArea,
): KonsoleMenuPosition {
  const opensLeft = trigger.right + submenu.width > bounds.x + bounds.width;
  const requestedLeft = opensLeft ? trigger.left - submenu.width + 2 : trigger.right - 2;
  const maximumLeft = Math.max(bounds.x, bounds.x + bounds.width - submenu.width);
  const maximumTop = Math.max(bounds.y, bounds.y + bounds.height - submenu.height);

  return {
    left: Math.min(Math.max(bounds.x, requestedLeft), maximumLeft),
    top: Math.min(Math.max(bounds.y, trigger.top - 3), maximumTop),
    opensLeft,
  };
}
