export type KonquerorExternalWebLoadStatus = "idle" | "loading" | "loaded" | "stopped";

export type KonquerorExternalWebLoadState = {
  readonly canonicalUrl: string | null;
  readonly generation: number;
  readonly status: KonquerorExternalWebLoadStatus;
};

export type KonquerorExternalWebLoadAction =
  | { readonly type: "start"; readonly canonicalUrl: string }
  | { readonly type: "loaded"; readonly canonicalUrl: string; readonly generation: number }
  | { readonly type: "stop" }
  | { readonly type: "clear" };

export const initialKonquerorExternalWebLoadState: KonquerorExternalWebLoadState = {
  canonicalUrl: null,
  generation: 0,
  status: "idle",
};

export function konquerorExternalWebLoadReducer(
  state: KonquerorExternalWebLoadState,
  action: KonquerorExternalWebLoadAction,
): KonquerorExternalWebLoadState {
  switch (action.type) {
    case "start":
      return {
        canonicalUrl: action.canonicalUrl,
        generation: state.generation + 1,
        status: "loading",
      };

    case "loaded":
      return state.status === "loading" &&
        state.canonicalUrl === action.canonicalUrl &&
        state.generation === action.generation
        ? { ...state, status: "loaded" }
        : state;

    case "stop":
      return state.status === "loading"
        ? { ...state, status: "stopped" }
        : state;

    case "clear":
      return state.canonicalUrl === null && state.status === "idle"
        ? state
        : { ...state, canonicalUrl: null, status: "idle" };

    default:
      return state;
  }
}
