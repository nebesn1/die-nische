import { extractCopiedText } from "./copiedText";

export const KLIPPER_KEYBOARD_SELECTION_SETTLE_MS = 200;

type ClosestCapableTarget = {
  readonly closest?: (selectors: string) => Element | null;
};

const ignoredSelectionSelectors = "[data-klipper-ignore-selection], button, [role=menuitem]";

export function shouldRecordKlipperSelection(target: EventTarget | null): boolean {
  if (typeof target !== "object" || target === null) {
    return true;
  }

  const closest = (target as ClosestCapableTarget).closest;
  return typeof closest !== "function" || closest.call(target, ignoredSelectionSelectors) === null;
}

export function isKeyboardSelectionKey(key: string, shiftKey: boolean): boolean {
  return shiftKey && ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"].includes(key);
}

export function extractWebDesktopSelection(target: EventTarget | null): string {
  return extractCopiedText(target);
}

export function isLiveSelectionTarget(target: EventTarget | null): boolean {
  if (typeof Node !== "undefined" && target instanceof Node) {
    return target.isConnected;
  }

  return true;
}
