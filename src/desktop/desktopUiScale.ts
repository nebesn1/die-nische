export type LogicalPoint = {
  readonly x: number;
  readonly y: number;
};

export type LogicalRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

const UI_SCALE_VARIABLE = "--kde-ui-scale";
const DESKTOP_SHELL_SELECTOR = ".desktop-shell";

const getMeasuredRootViewportSize = (): { readonly width: number; readonly height: number } | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const root = document.getElementById("root");
  if (!root) {
    return null;
  }

  const { width, height } = root.getBoundingClientRect();
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? { width, height }
    : null;
};

export function getCssViewportSize(): { readonly width: number; readonly height: number } {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  return getMeasuredRootViewportSize() ?? {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * The stylesheet is the runtime authority. The fallback keeps geometry tests
 * deterministic when Vitest does not load the application stylesheet.
 */
export function getRequestedDesktopUiScale(): number {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return 1;
  }

  const parsed = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue(UI_SCALE_VARIABLE));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * CSS zoom may be quantized by the browser. Geometry crossing the rendered
 * CSS-pixel boundary must use that applied value, not only the requested token.
 */
export function getEffectiveDesktopUiScale(): number {
  const requestedScale = getRequestedDesktopUiScale();

  if (typeof document === "undefined" || typeof window === "undefined") {
    return requestedScale;
  }

  const shell = document.querySelector(DESKTOP_SHELL_SELECTOR);
  if (!shell) {
    return requestedScale;
  }

  const shellStyle = window.getComputedStyle(shell);
  const computedZoom = Number.parseFloat(shellStyle.getPropertyValue("zoom") || shellStyle.zoom);
  return Number.isFinite(computedZoom) && computedZoom > 0 ? computedZoom : requestedScale;
}

/**
 * Backwards-compatible geometry entry point. All rendered-to-logical
 * conversion now uses the effective CSS zoom when the shell is mounted.
 */
export function getDesktopUiScale(): number {
  return getEffectiveDesktopUiScale();
}

export function getLogicalViewportSize(): { readonly width: number; readonly height: number } {
  const scale = getEffectiveDesktopUiScale();
  const viewport = getCssViewportSize();

  return {
    width: viewport.width / scale,
    height: viewport.height / scale,
  };
}

export function toLogicalCoordinate(value: number): number {
  return value / getDesktopUiScale();
}

export function toLogicalPoint(point: LogicalPoint): LogicalPoint {
  const scale = getDesktopUiScale();
  return { x: point.x / scale, y: point.y / scale };
}

export function toLogicalRect(rect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">): LogicalRect {
  const scale = getDesktopUiScale();
  return {
    left: rect.left / scale,
    top: rect.top / scale,
    right: rect.right / scale,
    bottom: rect.bottom / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}
