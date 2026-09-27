import type { WindowMenuPlacementInput, WindowMenuPosition } from "./types";

const clamp = (value: number, minimum: number, maximum: number): number => {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
};

export function positionWindowMenu({
  anchorRect,
  desktopRect,
  menuSize,
  screenArea,
}: WindowMenuPlacementInput): WindowMenuPosition {
  const preferredX = anchorRect.left - desktopRect.left;
  const preferredY = anchorRect.bottom - desktopRect.top + 1;
  const fallbackY = anchorRect.top - desktopRect.top - menuSize.height - 1;
  const minX = screenArea.x - desktopRect.left;
  const minY = screenArea.y - desktopRect.top;
  const maxX = Math.max(minX, screenArea.x + screenArea.width - desktopRect.left - menuSize.width);
  const maxY = Math.max(minY, screenArea.y + screenArea.height - desktopRect.top - menuSize.height);
  const wouldEnterScreen = preferredY + menuSize.height > screenArea.y + screenArea.height - desktopRect.top;
  const y = wouldEnterScreen ? fallbackY : preferredY;

  return {
    x: Math.round(clamp(preferredX, minX, maxX)),
    y: Math.round(clamp(y, minY, maxY)),
  };
}
