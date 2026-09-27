import { konquerorEmbeddedContentZoomLevels, type KonquerorEmbeddedContentZoomLevel } from "./embeddedContentModel";

export type KonquerorExternalWebZoomState = {
  readonly zoomLevel: KonquerorEmbeddedContentZoomLevel;
};

export type KonquerorExternalWebZoomAction = {
  readonly type: "zoom-in" | "zoom-out";
};

export type KonquerorExternalWebZoomGeometry = {
  readonly scale: number;
  readonly layoutWidthPercent: number;
  readonly layoutHeightPercent: number;
};

export const defaultKonquerorExternalWebZoomState: KonquerorExternalWebZoomState = Object.freeze({
  zoomLevel: 100,
});

export function canAdjustKonquerorExternalWebZoom(
  state: KonquerorExternalWebZoomState,
  direction: "in" | "out",
): boolean {
  const currentIndex = konquerorEmbeddedContentZoomLevels.indexOf(state.zoomLevel);

  return direction === "in"
    ? currentIndex < konquerorEmbeddedContentZoomLevels.length - 1
    : currentIndex > 0;
}

export function getKonquerorExternalWebZoomGeometry(
  zoomLevel: KonquerorEmbeddedContentZoomLevel,
): KonquerorExternalWebZoomGeometry {
  const scale = zoomLevel / 100;
  const inverseViewportPercent = Number((100 / scale).toFixed(6));

  return {
    scale,
    layoutWidthPercent: inverseViewportPercent,
    layoutHeightPercent: inverseViewportPercent,
  };
}

export function konquerorExternalWebZoomReducer(
  state: KonquerorExternalWebZoomState,
  action: KonquerorExternalWebZoomAction,
): KonquerorExternalWebZoomState {
  const currentIndex = konquerorEmbeddedContentZoomLevels.indexOf(state.zoomLevel);
  const nextIndex = action.type === "zoom-in"
    ? Math.min(currentIndex + 1, konquerorEmbeddedContentZoomLevels.length - 1)
    : Math.max(currentIndex - 1, 0);
  const zoomLevel = konquerorEmbeddedContentZoomLevels[nextIndex];

  return zoomLevel === state.zoomLevel ? state : { zoomLevel };
}
