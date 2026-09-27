import { clampKonquerorMediaTime, normalizeKonquerorVolume } from "./mediaTime";

export type KonquerorMediaLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "waiting"
  | "ended"
  | "stopped"
  | "error";

export type KonquerorMediaViewState = {
  readonly nodeId: string | null;
  readonly status: KonquerorMediaLoadStatus;
  readonly currentTime: number;
  readonly duration: number | null;
  readonly volume: number;
  readonly muted: boolean;
  readonly reloadToken: number;
  readonly stopToken: number;
};

export type KonquerorMediaViewAction =
  | { readonly type: "start"; readonly nodeId: string }
  | { readonly type: "reload" }
  | { readonly type: "stop" }
  | { readonly type: "loaded"; readonly nodeId: string }
  | { readonly type: "metadata"; readonly nodeId: string; readonly duration: number }
  | { readonly type: "duration-change"; readonly nodeId: string; readonly duration: number }
  | { readonly type: "play"; readonly nodeId: string }
  | { readonly type: "playing"; readonly nodeId: string }
  | { readonly type: "pause"; readonly nodeId: string }
  | { readonly type: "waiting"; readonly nodeId: string }
  | { readonly type: "canplay"; readonly nodeId: string }
  | { readonly type: "ended"; readonly nodeId: string; readonly currentTime: number }
  | { readonly type: "error"; readonly nodeId: string }
  | { readonly type: "play-rejected"; readonly nodeId: string }
  | { readonly type: "seek"; readonly nodeId: string; readonly currentTime: number }
  | { readonly type: "time-update"; readonly nodeId: string; readonly currentTime: number }
  | { readonly type: "volume-change"; readonly nodeId: string; readonly volume: number; readonly muted: boolean };

export const defaultKonquerorMediaViewState: KonquerorMediaViewState = Object.freeze({
  nodeId: null,
  status: "idle",
  currentTime: 0,
  duration: null,
  volume: 1,
  muted: false,
  reloadToken: 0,
  stopToken: 0,
});

const normalizeDuration = (duration: number): number | null =>
  Number.isFinite(duration) && duration >= 0 ? duration : null;

const resetPlayback = (
  state: KonquerorMediaViewState,
  nodeId: string,
  status: KonquerorMediaLoadStatus,
): KonquerorMediaViewState => ({
  ...state,
  nodeId,
  status,
  currentTime: 0,
  duration: null,
});

export function konquerorMediaViewReducer(
  state: KonquerorMediaViewState,
  action: KonquerorMediaViewAction,
): KonquerorMediaViewState {
  switch (action.type) {
    case "start":
      return action.nodeId === state.nodeId && state.status !== "idle"
        ? state
        : resetPlayback({
            ...defaultKonquerorMediaViewState,
            volume: state.volume,
            muted: state.muted,
          }, action.nodeId, "loading");
    case "reload":
      return state.nodeId === null
        ? state
        : {
            ...state,
            status: "loading",
            currentTime: 0,
            duration: null,
            reloadToken: state.reloadToken + 1,
          };
    case "stop":
      return state.nodeId === null
        ? state
        : { ...state, status: "stopped", currentTime: 0, stopToken: state.stopToken + 1 };
    case "loaded":
      return state.nodeId === action.nodeId && (state.status === "loading" || state.status === "waiting")
        ? { ...state, status: "ready" }
        : state;
    case "metadata":
    case "duration-change": {
      if (state.nodeId !== action.nodeId) return state;
      const duration = normalizeDuration(action.duration);
      const currentTime = clampKonquerorMediaTime(state.currentTime, duration);
      const status = state.status === "loading" || state.status === "waiting" ? "ready" : state.status;
      return state.duration === duration && state.currentTime === currentTime && state.status === status
        ? state
        : { ...state, status, duration, currentTime };
    }
    case "play":
    case "playing":
      return state.nodeId === action.nodeId ? { ...state, status: "playing" } : state;
    case "pause":
      return state.nodeId === action.nodeId && state.status !== "stopped" && state.status !== "ended" && state.status !== "loading"
        ? { ...state, status: "paused" }
        : state;
    case "waiting":
      return state.nodeId === action.nodeId && state.status !== "stopped" && state.status !== "error"
        ? { ...state, status: "waiting" }
        : state;
    case "canplay":
      return state.nodeId === action.nodeId && (state.status === "loading" || state.status === "waiting")
        ? { ...state, status: "ready" }
        : state;
    case "ended":
      return state.nodeId === action.nodeId
        ? { ...state, status: "ended", currentTime: clampKonquerorMediaTime(action.currentTime, state.duration) }
        : state;
    case "error":
    case "play-rejected":
      return state.nodeId === action.nodeId ? { ...state, status: "error" } : state;
    case "seek":
    case "time-update":
      return state.nodeId === action.nodeId
        ? { ...state, currentTime: clampKonquerorMediaTime(action.currentTime, state.duration) }
        : state;
    case "volume-change": {
      if (state.nodeId !== action.nodeId) return state;
      const volume = normalizeKonquerorVolume(action.volume);
      return state.volume === volume && state.muted === action.muted ? state : { ...state, volume, muted: action.muted };
    }
  }
}
