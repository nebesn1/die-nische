import type { DesktopWindow } from "./types";

type CaptionWindow = Pick<DesktopWindow, "appId" | "baseTitle" | "title">;

const getCollisionKey = (appId: string, baseTitle: string): string => `${appId}\u0000${baseTitle}`;

/**
 * Derives final shell display captions from application-provided base captions.
 * Input order is the stable WindowManager creation order; focus and z-index are
 * deliberately not part of collision ranking.
 */
export function disambiguateWindowCaptions<T extends CaptionWindow>(windows: readonly T[]): readonly T[] {
  const counts = new Map<string, number>();

  for (const window of windows) {
    const baseTitle = window.baseTitle ?? window.title;
    const key = getCollisionKey(window.appId, baseTitle);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ranks = new Map<string, number>();

  return windows.map((window) => {
    const baseTitle = window.baseTitle ?? window.title;
    const key = getCollisionKey(window.appId, baseTitle);
    const rank = (ranks.get(key) ?? 0) + 1;
    ranks.set(key, rank);
    const title = (counts.get(key) ?? 0) > 1 && rank > 1 ? `${baseTitle}<${rank}>` : baseTitle;

    return window.title === title && window.baseTitle === baseTitle
      ? window
      : { ...window, baseTitle, title };
  });
}
