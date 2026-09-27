import type { ApplicationCloseRequest, ApplicationLaunchRequest } from "./types";

export interface ApplicationRuntimeState {
  readonly latestLaunchRequestByWindowId: Readonly<Record<string, ApplicationLaunchRequest | null>>;
  readonly pendingCloseRequestByWindowId: Readonly<Record<string, ApplicationCloseRequest | null>>;
  readonly nextLaunchRequestSequence: number;
  readonly nextCloseRequestSequence: number;
  readonly nextInstanceSerialByApplicationId: Readonly<Record<string, number>>;
  readonly nextCascadeSerialByDesktopAndApplication: Readonly<Record<string, number>>;
}

export type ApplicationRuntimeAction =
  | {
      readonly type: "store-launch-request";
      readonly windowId: string;
      readonly request: ApplicationLaunchRequest;
    }
  | {
      readonly type: "store-close-request";
      readonly windowId: string;
      readonly request: ApplicationCloseRequest;
    }
  | {
      readonly type: "clear-close-request";
      readonly windowId: string;
      readonly requestId: number;
    }
  | {
      readonly type: "prune-window-requests";
      readonly windowIds: readonly string[];
    }
  | {
      readonly type: "reserve-instance-serial";
      readonly appId: string;
      readonly nextSerial: number;
    }
  | {
      readonly type: "reserve-cascade-serial";
      readonly key: string;
      readonly nextSerial: number;
    }
  | {
      readonly type: "reconcile-cascade-state";
      readonly nextSerialByDesktopAndApplication: Readonly<Record<string, number>>;
    }
  | { readonly type: "reset-session" };

export const initialApplicationRuntimeState: ApplicationRuntimeState = {
  latestLaunchRequestByWindowId: {},
  pendingCloseRequestByWindowId: {},
  nextLaunchRequestSequence: 1,
  nextCloseRequestSequence: 1,
  nextInstanceSerialByApplicationId: {},
  nextCascadeSerialByDesktopAndApplication: {},
};

export function createApplicationLaunchRequest(
  state: ApplicationRuntimeState,
  intent: unknown,
): {
  readonly state: ApplicationRuntimeState;
  readonly request: ApplicationLaunchRequest;
} {
  const request: ApplicationLaunchRequest = {
    requestId: state.nextLaunchRequestSequence,
    intent,
  };

  return {
    request,
    state: {
      ...state,
      nextLaunchRequestSequence: state.nextLaunchRequestSequence + 1,
    },
  };
}

export function createApplicationCloseRequest(
  state: ApplicationRuntimeState,
): {
  readonly state: ApplicationRuntimeState;
  readonly request: ApplicationCloseRequest;
} {
  const request: ApplicationCloseRequest = { requestId: state.nextCloseRequestSequence };

  return {
    request,
    state: {
      ...state,
      nextCloseRequestSequence: state.nextCloseRequestSequence + 1,
    },
  };
}

export function applicationRuntimeReducer(
  state: ApplicationRuntimeState,
  action: ApplicationRuntimeAction,
): ApplicationRuntimeState {
  switch (action.type) {
    case "store-launch-request":
      return {
        ...state,
        latestLaunchRequestByWindowId: {
          ...state.latestLaunchRequestByWindowId,
          [action.windowId]: action.request,
        },
        nextLaunchRequestSequence: Math.max(state.nextLaunchRequestSequence, action.request.requestId + 1),
      };

    case "store-close-request":
      return {
        ...state,
        pendingCloseRequestByWindowId: {
          ...state.pendingCloseRequestByWindowId,
          [action.windowId]: action.request,
        },
        nextCloseRequestSequence: Math.max(state.nextCloseRequestSequence, action.request.requestId + 1),
      };

    case "clear-close-request": {
      const current = state.pendingCloseRequestByWindowId[action.windowId];

      if (!current || current.requestId !== action.requestId) {
        return state;
      }

      const pendingCloseRequestByWindowId = { ...state.pendingCloseRequestByWindowId };
      delete pendingCloseRequestByWindowId[action.windowId];
      return { ...state, pendingCloseRequestByWindowId };
    }

    case "prune-window-requests": {
      const windowIds = new Set(action.windowIds);
      const nextRequests: Record<string, ApplicationLaunchRequest | null> = {};
      const nextCloseRequests: Record<string, ApplicationCloseRequest | null> = {};
      let changed = false;

      for (const [windowId, request] of Object.entries(state.latestLaunchRequestByWindowId)) {
        if (windowIds.has(windowId)) {
          nextRequests[windowId] = request;
        } else {
          changed = true;
        }
      }

      for (const [windowId, request] of Object.entries(state.pendingCloseRequestByWindowId)) {
        if (windowIds.has(windowId)) {
          nextCloseRequests[windowId] = request;
        } else {
          changed = true;
        }
      }

      return changed
        ? {
            ...state,
            latestLaunchRequestByWindowId: nextRequests,
            pendingCloseRequestByWindowId: nextCloseRequests,
          }
        : state;
    }

    case "reserve-instance-serial":
      return {
        ...state,
        nextInstanceSerialByApplicationId: {
          ...state.nextInstanceSerialByApplicationId,
          [action.appId]: Math.max(state.nextInstanceSerialByApplicationId[action.appId] ?? 1, action.nextSerial),
        },
      };

    case "reserve-cascade-serial":
      return {
        ...state,
        nextCascadeSerialByDesktopAndApplication: {
          ...state.nextCascadeSerialByDesktopAndApplication,
          [action.key]: Math.max(state.nextCascadeSerialByDesktopAndApplication[action.key] ?? 0, action.nextSerial),
        },
      };

    case "reconcile-cascade-state":
      return {
        ...state,
        nextCascadeSerialByDesktopAndApplication: action.nextSerialByDesktopAndApplication,
      };

    case "reset-session":
      return initialApplicationRuntimeState;

    default:
      return state;
  }
}
