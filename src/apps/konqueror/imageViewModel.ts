export type KonquerorImageZoom = "fit-window" | "fit-width" | "fit-height" | 50 | 100 | 200;
export type KonquerorImageDimensions = { readonly width: number; readonly height: number };
export type KonquerorImageLoadStatus = "idle" | "loading" | "loaded" | "stopped" | "error";

export type KonquerorImageViewState = {
  readonly nodeId: string | null;
  readonly zoom: KonquerorImageZoom;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly status: KonquerorImageLoadStatus;
  readonly dimensions: KonquerorImageDimensions | null;
};

export type KonquerorImageViewAction =
  | { readonly type: "start"; readonly nodeId: string }
  | { readonly type: "loaded"; readonly nodeId: string; readonly dimensions: KonquerorImageDimensions }
  | { readonly type: "error"; readonly nodeId: string }
  | { readonly type: "stop" }
  | { readonly type: "zoom-in" | "zoom-out" }
  | { readonly type: "set-zoom"; readonly zoom: KonquerorImageZoom }
  | { readonly type: "rotate-right" };

export const defaultKonquerorImageViewState: KonquerorImageViewState = Object.freeze({
  nodeId: null,
  zoom: "fit-window",
  rotation: 0,
  status: "idle",
  dimensions: null,
});

const zoomSteps = [50, 100, 200] as const;

export const getKonquerorImageZoomLabel = (zoom: KonquerorImageZoom): string =>
  zoom === "fit-window" ? "Fit to Window"
  : zoom === "fit-width" ? "Fit to Width"
  : zoom === "fit-height" ? "Fit to Height"
  : `${zoom}%`;

export const canAdjustKonquerorImageZoom = (
  state: KonquerorImageViewState,
  direction: "in" | "out",
): boolean => {
  if (typeof state.zoom !== "number") return true;
  const index = zoomSteps.indexOf(state.zoom);
  return direction === "in" ? index < zoomSteps.length - 1 : index > 0;
};

export function konquerorImageViewReducer(
  state: KonquerorImageViewState,
  action: KonquerorImageViewAction,
): KonquerorImageViewState {
  switch (action.type) {
    case "start":
      if (state.nodeId === action.nodeId && state.status === "loading") return state;
      return {
        ...state,
        nodeId: action.nodeId,
        status: "loading",
        dimensions: state.nodeId === action.nodeId ? state.dimensions : null,
        rotation: state.nodeId === action.nodeId ? state.rotation : 0,
      };
    case "loaded":
      return state.nodeId === action.nodeId
        ? { ...state, status: "loaded", dimensions: action.dimensions }
        : state;
    case "error":
      return state.nodeId === action.nodeId ? { ...state, status: "error", dimensions: null } : state;
    case "stop":
      return state.status === "loading" ? { ...state, status: "stopped" } : state;
    case "set-zoom":
      return state.zoom === action.zoom ? state : { ...state, zoom: action.zoom };
    case "zoom-in":
    case "zoom-out": {
      const currentIndex = typeof state.zoom === "number" ? zoomSteps.indexOf(state.zoom) : zoomSteps.indexOf(100);
      const nextIndex = action.type === "zoom-in"
        ? Math.min(currentIndex + 1, zoomSteps.length - 1)
        : Math.max(currentIndex - 1, 0);
      return { ...state, zoom: zoomSteps[nextIndex] ?? 100 };
    }
    case "rotate-right":
      return { ...state, rotation: ((state.rotation + 90) % 360) as 0 | 90 | 180 | 270 };
  }
}
