import type { DesktopWindow } from "../window-manager/types";

/** Browser boot starts with the same clean window session produced by End Session. */
export function createInitialApplicationWindows(): readonly DesktopWindow[] {
  return [];
}
