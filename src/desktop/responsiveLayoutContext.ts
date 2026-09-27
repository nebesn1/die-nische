import { createContext, useContext } from "react";
import { getCssViewportSize, getEffectiveDesktopUiScale } from "./desktopUiScale";
import {
  deriveResponsiveLayout,
  emptyResponsiveLayout,
  type ResponsiveLayoutState,
} from "./responsiveLayout";

const PANEL_HEIGHT_VARIABLE = "--kde-panel-height";
const TITLEBAR_HEIGHT_VARIABLE = "--kde-titlebar-height";
const SAFE_AREA_VARIABLES = {
  top: "--kde-safe-area-inset-top",
  right: "--kde-safe-area-inset-right",
  bottom: "--kde-safe-area-inset-bottom",
  left: "--kde-safe-area-inset-left",
} as const;

const LOGICAL_LAYOUT_VARIABLES = {
  effectiveScale: "--kde-effective-ui-scale",
  effectiveScaleInverse: "--kde-effective-ui-scale-inverse",
  viewportWidth: "--kde-logical-viewport-width",
  viewportHeight: "--kde-logical-viewport-height",
  workAreaWidth: "--kde-logical-work-area-width",
  workAreaHeight: "--kde-logical-work-area-height",
  safeAreaTop: "--kde-logical-safe-area-inset-top",
  safeAreaRight: "--kde-logical-safe-area-inset-right",
  safeAreaBottom: "--kde-logical-safe-area-inset-bottom",
  safeAreaLeft: "--kde-logical-safe-area-inset-left",
} as const;

const readCssPixelVariable = (name: string, fallback: number): number => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

export function readResponsiveLayoutFromBrowser(): ResponsiveLayoutState {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return emptyResponsiveLayout;
  }

  const viewport = getCssViewportSize();
  return deriveResponsiveLayout({
    cssViewportWidth: viewport.width,
    cssViewportHeight: viewport.height,
    uiScale: getEffectiveDesktopUiScale(),
    panelHeight: readCssPixelVariable(PANEL_HEIGHT_VARIABLE, 46),
    titleBarHeight: readCssPixelVariable(TITLEBAR_HEIGHT_VARIABLE, 22),
    safeAreaInsetsCss: {
      top: readCssPixelVariable(SAFE_AREA_VARIABLES.top, 0),
      right: readCssPixelVariable(SAFE_AREA_VARIABLES.right, 0),
      bottom: readCssPixelVariable(SAFE_AREA_VARIABLES.bottom, 0),
      left: readCssPixelVariable(SAFE_AREA_VARIABLES.left, 0),
    },
  });
}

/**
 * Publishes the responsive snapshot as the shell's semantic logical geometry.
 * The stylesheet keeps a requested-scale bootstrap fallback, then this single
 * root-level snapshot becomes the CSS authority after the shell is mounted.
 */
export function applyResponsiveLayoutCssVariables(layout: ResponsiveLayoutState): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const root = document.documentElement;
  const values: Readonly<Record<string, string>> = {
    [LOGICAL_LAYOUT_VARIABLES.effectiveScale]: `${layout.uiScale}`,
    [LOGICAL_LAYOUT_VARIABLES.effectiveScaleInverse]: `${1 / layout.uiScale}`,
    [LOGICAL_LAYOUT_VARIABLES.viewportWidth]: `${layout.logicalViewportWidth}px`,
    [LOGICAL_LAYOUT_VARIABLES.viewportHeight]: `${layout.logicalViewportHeight}px`,
    [LOGICAL_LAYOUT_VARIABLES.workAreaWidth]: `${layout.logicalWorkAreaWidth}px`,
    [LOGICAL_LAYOUT_VARIABLES.workAreaHeight]: `${layout.logicalWorkAreaHeight}px`,
    [LOGICAL_LAYOUT_VARIABLES.safeAreaTop]: `${layout.safeAreaInsets.top}px`,
    [LOGICAL_LAYOUT_VARIABLES.safeAreaRight]: `${layout.safeAreaInsets.right}px`,
    [LOGICAL_LAYOUT_VARIABLES.safeAreaBottom]: `${layout.safeAreaInsets.bottom}px`,
    [LOGICAL_LAYOUT_VARIABLES.safeAreaLeft]: `${layout.safeAreaInsets.left}px`,
  };
  const previousValues = new Map<string, string>();

  for (const [property, value] of Object.entries(values)) {
    previousValues.set(property, root.style.getPropertyValue(property));
    root.style.setProperty(property, value);
  }

  return () => {
    for (const [property, value] of previousValues) {
      if (value) {
        root.style.setProperty(property, value);
      } else {
        root.style.removeProperty(property);
      }
    }
  };
}

export const ResponsiveLayoutContext = createContext<ResponsiveLayoutState | null>(null);

export function useResponsiveLayout(): ResponsiveLayoutState {
  return useContext(ResponsiveLayoutContext) ?? emptyResponsiveLayout;
}

export function useOptionalResponsiveLayout(): ResponsiveLayoutState | null {
  return useContext(ResponsiveLayoutContext);
}
