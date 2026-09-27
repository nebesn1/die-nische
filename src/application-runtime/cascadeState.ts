import type { DesktopId, DesktopWindow } from "../window-manager/types";

export interface ApplicationCascadeState {
  readonly nextSerialByDesktopAndApplication: Readonly<Record<string, number>>;
}

export const initialApplicationCascadeState: ApplicationCascadeState = {
  nextSerialByDesktopAndApplication: {},
};

export const getApplicationCascadeKey = (desktopId: DesktopId, appId: string): string => `${desktopId}:${appId}`;

const haveSameSerials = (left: Readonly<Record<string, number>>, right: Readonly<Record<string, number>>): boolean => {
  const leftEntries = Object.entries(left);

  return leftEntries.length === Object.keys(right).length
    && leftEntries.every(([key, serial]) => right[key] === serial);
};

/**
 * Keeps slots monotonic while a desktop/application group is non-empty.
 * A group populated by Move to Desktop seeds its next slot from open members.
 */
export function reconcileApplicationCascadeState(
  state: ApplicationCascadeState,
  windows: readonly DesktopWindow[],
): ApplicationCascadeState {
  const openCountByKey: Record<string, number> = {};

  for (const window of windows) {
    const key = getApplicationCascadeKey(window.desktopId, window.appId);
    openCountByKey[key] = (openCountByKey[key] ?? 0) + 1;
  }

  const nextSerialByDesktopAndApplication = Object.fromEntries(
    Object.entries(openCountByKey).map(([key, openCount]) => [
      key,
      Math.max(state.nextSerialByDesktopAndApplication[key] ?? 0, openCount),
    ]),
  );

  return haveSameSerials(state.nextSerialByDesktopAndApplication, nextSerialByDesktopAndApplication)
    ? state
    : { nextSerialByDesktopAndApplication };
}

/** Allocates a visual cascade slot without affecting WindowId allocation. */
export function reserveApplicationCascadeSerial(
  state: ApplicationCascadeState,
  desktopId: DesktopId,
  appId: string,
): { readonly serial: number; readonly state: ApplicationCascadeState } {
  const key = getApplicationCascadeKey(desktopId, appId);
  const serial = state.nextSerialByDesktopAndApplication[key] ?? 0;

  return {
    serial,
    state: {
      nextSerialByDesktopAndApplication: {
        ...state.nextSerialByDesktopAndApplication,
        [key]: serial + 1,
      },
    },
  };
}
