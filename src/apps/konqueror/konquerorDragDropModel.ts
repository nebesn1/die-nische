export type KonquerorDirectDropAction = "move" | "copy" | "link";

export const KONQUEROR_DND_AUTO_EXPAND_DELAY_MS = 700;
export const KONQUEROR_DND_AUTO_SCROLL_EDGE_PX = 24;
export const KONQUEROR_DND_AUTO_SCROLL_STEP_PX = 12;
export const KONQUEROR_DND_AUTO_SCROLL_INTERVAL_MS = 60;

export type KonquerorDropModifierState = {
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};

export function getKonquerorDirectDropAction(modifiers: KonquerorDropModifierState): KonquerorDirectDropAction | null {
  if (modifiers.altKey || modifiers.metaKey) return null;
  if (modifiers.ctrlKey && modifiers.shiftKey) return "link";
  if (modifiers.ctrlKey) return "copy";
  if (modifiers.shiftKey) return "move";
  return null;
}

export function getKonquerorVerticalAutoScrollDirection(
  clientY: number,
  viewportTop: number,
  viewportBottom: number,
  scrollTop: number,
  maximumScrollTop: number,
): -1 | 0 | 1 {
  if (clientY < viewportTop || clientY > viewportBottom) return 0;
  if (clientY - viewportTop <= KONQUEROR_DND_AUTO_SCROLL_EDGE_PX) return scrollTop > 0 ? -1 : 0;
  if (viewportBottom - clientY <= KONQUEROR_DND_AUTO_SCROLL_EDGE_PX) return scrollTop < maximumScrollTop ? 1 : 0;
  return 0;
}
