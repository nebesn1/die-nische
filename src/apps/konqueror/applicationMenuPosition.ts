export {
  getApplicationMenuPopupPosition as getKonquerorApplicationMenuPopupPosition,
  type ApplicationMenuPopupPosition as KonquerorApplicationMenuPopupPosition,
} from "../applicationMenuPosition";

export function getKonquerorSubmenuPosition(
  trigger: { readonly left: number; readonly top: number; readonly right: number },
  submenu: { readonly width: number; readonly height: number },
  bounds: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
): { readonly opensLeft: boolean; readonly offsetX: number; readonly offsetY: number } {
  const opensLeft = trigger.right + submenu.width > bounds.right;
  const requestedLeft = opensLeft ? trigger.left - submenu.width + 2 : trigger.right - 2;
  const clampedLeft = Math.min(Math.max(bounds.left, requestedLeft), Math.max(bounds.left, bounds.right - submenu.width));
  const requestedTop = trigger.top - 2;
  const clampedTop = Math.min(Math.max(bounds.top, requestedTop), Math.max(bounds.top, bounds.bottom - submenu.height));
  return {
    opensLeft,
    offsetX: clampedLeft - requestedLeft,
    offsetY: clampedTop - requestedTop,
  };
}
