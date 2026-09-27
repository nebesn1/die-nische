import type { ScreenArea } from "../../window-manager/types";

export type KCalcConstantsSubmenuPosition = Readonly<{
  left: number;
  top: number;
  opensLeft: boolean;
}>;

type TriggerRect = Readonly<{
  left: number;
  right: number;
  top: number;
}>;

/** Opens beside the category row, flips left at ScreenArea's right edge, and clamps vertically. */
export const getKCalcConstantsSubmenuPosition = (
  trigger: TriggerRect,
  popup: Readonly<{ width: number; height: number }>,
  screenArea: ScreenArea,
): KCalcConstantsSubmenuPosition => {
  const minimumLeft = screenArea.x;
  const maximumLeft = Math.max(minimumLeft, screenArea.x + screenArea.width - popup.width);
  const minimumTop = screenArea.y;
  const maximumTop = Math.max(minimumTop, screenArea.y + screenArea.height - popup.height);
  const rightLeft = trigger.right - 2;
  const opensLeft = rightLeft + popup.width > screenArea.x + screenArea.width;
  const preferredLeft = opensLeft ? trigger.left - popup.width + 2 : rightLeft;

  return {
    left: Math.min(Math.max(minimumLeft, preferredLeft), maximumLeft),
    top: Math.min(Math.max(minimumTop, trigger.top), maximumTop),
    opensLeft,
  };
};
