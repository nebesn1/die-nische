import type { KonquerorPreviewerId } from "./previewModel";
import type { KonquerorView } from "./navigationTypes";

export type KonquerorEmbeddedContentKind = "internal-web" | "document" | "none";
export type KonquerorEmbeddedContentZoomLevel = 75 | 90 | 100 | 110 | 125 | 150;

export const konquerorEmbeddedContentZoomLevels = [75, 90, 100, 110, 125, 150] as const;

export type KonquerorEmbeddedContentCapabilities = {
  readonly kind: KonquerorEmbeddedContentKind;
  readonly canZoom: boolean;
  readonly canPrint: boolean;
};

export type KonquerorEmbeddedContentState = {
  readonly internalWebZoomLevel: KonquerorEmbeddedContentZoomLevel;
  readonly documentZoomLevel: KonquerorEmbeddedContentZoomLevel;
};

export type KonquerorEmbeddedContentAction = {
  readonly type: "zoom-in" | "zoom-out";
  readonly kind: Exclude<KonquerorEmbeddedContentKind, "none">;
};

export const defaultKonquerorEmbeddedContentState: KonquerorEmbeddedContentState = Object.freeze({
  internalWebZoomLevel: 100,
  documentZoomLevel: 100,
});

const INTERNAL_WEB_CAPABILITIES: KonquerorEmbeddedContentCapabilities = Object.freeze({
  kind: "internal-web",
  canZoom: true,
  canPrint: true,
});

const DOCUMENT_CAPABILITIES: KonquerorEmbeddedContentCapabilities = Object.freeze({
  kind: "document",
  canZoom: true,
  canPrint: true,
});

const NO_EMBEDDED_CONTENT_CAPABILITIES: KonquerorEmbeddedContentCapabilities = Object.freeze({
  kind: "none",
  canZoom: false,
  canPrint: false,
});

export function getKonquerorEmbeddedContentCapabilities(
  view: KonquerorView,
  previewerId: KonquerorPreviewerId | null,
): KonquerorEmbeddedContentCapabilities {
  if (view.type === "about-konqueror" || (view.type === "file" && previewerId === "khtml")) {
    return INTERNAL_WEB_CAPABILITIES;
  }

  if (view.type === "file" && (previewerId === "embedded-text" || previewerId === "markdown")) {
    return DOCUMENT_CAPABILITIES;
  }

  return NO_EMBEDDED_CONTENT_CAPABILITIES;
}

export function getKonquerorEmbeddedContentZoomLevel(
  state: KonquerorEmbeddedContentState,
  kind: Exclude<KonquerorEmbeddedContentKind, "none">,
): KonquerorEmbeddedContentZoomLevel {
  return kind === "internal-web" ? state.internalWebZoomLevel : state.documentZoomLevel;
}

export function canAdjustKonquerorEmbeddedContentZoom(
  state: KonquerorEmbeddedContentState,
  kind: Exclude<KonquerorEmbeddedContentKind, "none">,
  direction: "in" | "out",
): boolean {
  const currentIndex = konquerorEmbeddedContentZoomLevels.indexOf(
    getKonquerorEmbeddedContentZoomLevel(state, kind),
  );

  return direction === "in"
    ? currentIndex < konquerorEmbeddedContentZoomLevels.length - 1
    : currentIndex > 0;
}

export function konquerorEmbeddedContentReducer(
  state: KonquerorEmbeddedContentState,
  action: KonquerorEmbeddedContentAction,
): KonquerorEmbeddedContentState {
  const current = getKonquerorEmbeddedContentZoomLevel(state, action.kind);
  const currentIndex = konquerorEmbeddedContentZoomLevels.indexOf(current);
  const nextIndex = action.type === "zoom-in"
    ? Math.min(currentIndex + 1, konquerorEmbeddedContentZoomLevels.length - 1)
    : Math.max(currentIndex - 1, 0);
  const next = konquerorEmbeddedContentZoomLevels[nextIndex];

  if (next === current) {
    return state;
  }

  return action.kind === "internal-web"
    ? { ...state, internalWebZoomLevel: next }
    : { ...state, documentZoomLevel: next };
}
