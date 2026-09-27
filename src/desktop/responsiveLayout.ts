export const MOBILE_LAYOUT_MAX_LOGICAL_WIDTH = 480;

export type DesktopLayoutMode = "desktop" | "mobile";
export type DesktopOrientation = "portrait" | "landscape";

export type SafeAreaInsets = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export type ResponsiveLayoutInput = {
  /** Browser CSS viewport dimensions, before the desktop UI scale is applied. */
  readonly cssViewportWidth: number;
  readonly cssViewportHeight: number;
  readonly uiScale: number;
  /** The existing logical Kicker height; safe areas are not applied to it yet. */
  readonly panelHeight: number;
  /** CSS-pixel values read from the root safe-area bridge variables. */
  readonly safeAreaInsetsCss?: Partial<SafeAreaInsets>;
  readonly titleBarHeight?: number;
};

export type ResponsiveLayoutState = {
  readonly layoutMode: DesktopLayoutMode;
  readonly orientation: DesktopOrientation;
  readonly uiScale: number;
  readonly cssViewportWidth: number;
  readonly cssViewportHeight: number;
  readonly logicalViewportWidth: number;
  readonly logicalViewportHeight: number;
  readonly logicalWorkAreaWidth: number;
  readonly logicalWorkAreaHeight: number;
  readonly titleBarHeight: number;
  /** Safe-area values are exposed in the same logical coordinate space as the shell. */
  readonly safeAreaInsets: SafeAreaInsets;
};

const EMPTY_SAFE_AREA_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const finiteNonNegative = (value: number | undefined, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;

export function deriveResponsiveLayout(input: ResponsiveLayoutInput): ResponsiveLayoutState {
  const uiScale = typeof input.uiScale === "number" && Number.isFinite(input.uiScale) && input.uiScale > 0
    ? input.uiScale
    : 1;
  const cssViewportWidth = finiteNonNegative(input.cssViewportWidth);
  const cssViewportHeight = finiteNonNegative(input.cssViewportHeight);
  const logicalViewportWidth = cssViewportWidth / uiScale;
  const logicalViewportHeight = cssViewportHeight / uiScale;
  const panelHeight = finiteNonNegative(input.panelHeight);
  const safeAreaInsetsCss = input.safeAreaInsetsCss ?? EMPTY_SAFE_AREA_INSETS;

  return {
    layoutMode: logicalViewportWidth <= MOBILE_LAYOUT_MAX_LOGICAL_WIDTH ? "mobile" : "desktop",
    orientation: logicalViewportWidth <= logicalViewportHeight ? "portrait" : "landscape",
    uiScale,
    cssViewportWidth,
    cssViewportHeight,
    logicalViewportWidth,
    logicalViewportHeight,
    logicalWorkAreaWidth: logicalViewportWidth,
    logicalWorkAreaHeight: Math.max(0, logicalViewportHeight - panelHeight),
    titleBarHeight: finiteNonNegative(input.titleBarHeight),
    safeAreaInsets: {
      top: finiteNonNegative(safeAreaInsetsCss.top) / uiScale,
      right: finiteNonNegative(safeAreaInsetsCss.right) / uiScale,
      bottom: finiteNonNegative(safeAreaInsetsCss.bottom) / uiScale,
      left: finiteNonNegative(safeAreaInsetsCss.left) / uiScale,
    },
  };
}

export function areResponsiveLayoutsEqual(
  first: ResponsiveLayoutState,
  second: ResponsiveLayoutState,
): boolean {
  return first.layoutMode === second.layoutMode
    && first.orientation === second.orientation
    && first.uiScale === second.uiScale
    && first.cssViewportWidth === second.cssViewportWidth
    && first.cssViewportHeight === second.cssViewportHeight
    && first.logicalViewportWidth === second.logicalViewportWidth
    && first.logicalViewportHeight === second.logicalViewportHeight
    && first.logicalWorkAreaWidth === second.logicalWorkAreaWidth
    && first.logicalWorkAreaHeight === second.logicalWorkAreaHeight
    && first.titleBarHeight === second.titleBarHeight
    && first.safeAreaInsets.top === second.safeAreaInsets.top
    && first.safeAreaInsets.right === second.safeAreaInsets.right
    && first.safeAreaInsets.bottom === second.safeAreaInsets.bottom
    && first.safeAreaInsets.left === second.safeAreaInsets.left;
}

export const emptyResponsiveLayout: ResponsiveLayoutState = {
  layoutMode: "desktop",
  orientation: "landscape",
  uiScale: 1,
  cssViewportWidth: 0,
  cssViewportHeight: 0,
  logicalViewportWidth: 0,
  logicalViewportHeight: 0,
  logicalWorkAreaWidth: 0,
  logicalWorkAreaHeight: 0,
  titleBarHeight: 0,
  safeAreaInsets: EMPTY_SAFE_AREA_INSETS,
};
