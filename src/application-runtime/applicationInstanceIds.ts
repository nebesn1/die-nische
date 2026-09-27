import type { ApplicationId, WindowId } from "../window-manager/types";

export interface ApplicationInstanceSerialState {
  readonly nextInstanceSerialByApplicationId: Readonly<Record<ApplicationId, number>>;
}

export const initialApplicationInstanceSerialState: ApplicationInstanceSerialState = {
  nextInstanceSerialByApplicationId: {},
};

export function getApplicationWindowId(appId: ApplicationId, serial: number): WindowId {
  return serial <= 1 ? `app:${appId}` : `app:${appId}::${serial}`;
}

export function getNextApplicationInstanceSerial(
  appId: ApplicationId,
  windowIds: readonly WindowId[],
): number {
  const baseId = getApplicationWindowId(appId, 1);
  let highestSerial = 0;

  for (const windowId of windowIds) {
    if (windowId === baseId) {
      highestSerial = Math.max(highestSerial, 1);
      continue;
    }

    const match = new RegExp(`^${baseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}::(\\d+)$`).exec(windowId);
    const serial = match ? Number(match[1]) : Number.NaN;

    if (Number.isSafeInteger(serial) && serial > 1) {
      highestSerial = Math.max(highestSerial, serial);
    }
  }

  return highestSerial + 1;
}

export function reserveApplicationInstanceId(
  state: ApplicationInstanceSerialState,
  appId: ApplicationId,
  existingWindowIds: readonly WindowId[],
): {
  readonly windowId: WindowId;
  readonly state: ApplicationInstanceSerialState;
} {
  const serial = Math.max(
    state.nextInstanceSerialByApplicationId[appId] ?? 1,
    getNextApplicationInstanceSerial(appId, existingWindowIds),
  );

  return {
    windowId: getApplicationWindowId(appId, serial),
    state: {
      nextInstanceSerialByApplicationId: {
        ...state.nextInstanceSerialByApplicationId,
        [appId]: serial + 1,
      },
    },
  };
}
