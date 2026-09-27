import type { ApplicationId, DesktopWindow, WindowId } from "../window-manager/types";

export type TaskbarEntry =
  | {
      readonly type: "window";
      readonly window: DesktopWindow;
    }
  | {
      readonly type: "group";
      readonly appId: ApplicationId;
      readonly windows: readonly DesktopWindow[];
      readonly representativeWindowId: WindowId;
    };

const getRepresentativeWindow = (
  windows: readonly DesktopWindow[],
  lastActiveWindowId: WindowId | null,
  currentDesktopId?: DesktopWindow["desktopId"],
): DesktopWindow => {
  return windows.find((desktopWindow) => desktopWindow.isActive)
    ?? windows.find((desktopWindow) => desktopWindow.id === lastActiveWindowId)
    ?? windows.find((desktopWindow) => desktopWindow.desktopId === currentDesktopId)
    ?? windows[0];
};

/** Groups an already scoped, creation-ordered task source by application id. */
export function groupTaskbarWindows(
  windows: readonly DesktopWindow[],
  lastActiveWindowId: WindowId | null,
  currentDesktopId?: DesktopWindow["desktopId"],
): readonly TaskbarEntry[] {
  const windowsByApplicationId = new Map<ApplicationId, DesktopWindow[]>();

  for (const desktopWindow of windows) {
    const appWindows = windowsByApplicationId.get(desktopWindow.appId);
    if (appWindows) {
      appWindows.push(desktopWindow);
    } else {
      windowsByApplicationId.set(desktopWindow.appId, [desktopWindow]);
    }
  }

  const emittedApplicationIds = new Set<ApplicationId>();
  const entries: TaskbarEntry[] = [];

  for (const desktopWindow of windows) {
    if (emittedApplicationIds.has(desktopWindow.appId)) {
      continue;
    }

    emittedApplicationIds.add(desktopWindow.appId);
    const appWindows = windowsByApplicationId.get(desktopWindow.appId) ?? [];

    if (appWindows.length === 1) {
      entries.push({ type: "window", window: appWindows[0] });
      continue;
    }

    entries.push({
      type: "group",
      appId: desktopWindow.appId,
      windows: appWindows,
      representativeWindowId: getRepresentativeWindow(appWindows, lastActiveWindowId, currentDesktopId).id,
    });
  }

  return entries;
}
