import type { ResizeDirection, ScreenArea, WindowBounds, WorkArea } from "./types";
import { clamp } from "./geometry";

/** Logical breathing room around normal mobile windows. */
export const MOBILE_WINDOW_MARGIN = 4;

const finiteDimension = (value: number, fallback = 1): number =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

const positiveDimension = (value: number): number => Math.max(1, Math.round(finiteDimension(value)));

const finiteCoordinate = (value: number): number => Number.isFinite(value) ? value : 0;

const effectiveMinimum = (declared: number, available: number): number => {
  const safeAvailable = Math.max(0, Math.round(finiteDimension(available, 0)));

  if (safeAvailable === 0) {
    return 0;
  }

  return Math.min(positiveDimension(declared), safeAvailable);
};

export type MobileWindowSafeRect = ScreenArea;

export function getMobileWindowSafeRect(workArea: WorkArea): MobileWindowSafeRect {
  const width = Math.max(0, finiteDimension(workArea.width, 0));
  const height = Math.max(0, finiteDimension(workArea.height, 0));
  const margin = Math.min(MOBILE_WINDOW_MARGIN, width / 2, height / 2);

  return {
    x: finiteCoordinate(workArea.x) + margin,
    y: finiteCoordinate(workArea.y) + margin,
    width: Math.max(0, width - margin * 2),
    height: Math.max(0, height - margin * 2),
  };
}

export function getMobileEffectiveMinimumSize(
  minimumWidth: number,
  minimumHeight: number,
  safeRect: MobileWindowSafeRect,
): { readonly width: number; readonly height: number } {
  return {
    width: effectiveMinimum(minimumWidth, safeRect.width),
    height: effectiveMinimum(minimumHeight, safeRect.height),
  };
}

const resolveMobileSize = (
  bounds: WindowBounds,
  safeRect: MobileWindowSafeRect,
  minimumWidth: number,
  minimumHeight: number,
): { readonly width: number; readonly height: number } => {
  const minimum = getMobileEffectiveMinimumSize(minimumWidth, minimumHeight, safeRect);
  const safeWidth = Math.max(0, safeRect.width);
  const safeHeight = Math.max(0, safeRect.height);

  return {
    width: safeWidth === 0 ? 0 : Math.min(safeWidth, Math.max(minimum.width, positiveDimension(bounds.width))),
    height: safeHeight === 0 ? 0 : Math.min(safeHeight, Math.max(minimum.height, positiveDimension(bounds.height))),
  };
};

/** Fits a normal window into the safe rect while preserving its current position where possible. */
export function clampWindowToMobileSafeRect(
  bounds: WindowBounds,
  workArea: WorkArea,
  minimumWidth = 1,
  minimumHeight = 1,
): WindowBounds {
  const safeRect = getMobileWindowSafeRect(workArea);
  const size = resolveMobileSize(bounds, safeRect, minimumWidth, minimumHeight);

  return {
    x: clamp(Math.round(finiteCoordinate(bounds.x)), safeRect.x, safeRect.x + Math.max(0, safeRect.width - size.width)),
    y: clamp(Math.round(finiteCoordinate(bounds.y)), safeRect.y, safeRect.y + Math.max(0, safeRect.height - size.height)),
    width: size.width,
    height: size.height,
  };
}

/** Keeps an existing normal window contained without enlarging it during a viewport expansion. */
export function containWindowInMobileSafeRect(
  bounds: WindowBounds,
  workArea: WorkArea,
): WindowBounds {
  const safeRect = getMobileWindowSafeRect(workArea);
  const width = safeRect.width === 0 ? 0 : Math.min(safeRect.width, positiveDimension(bounds.width));
  const height = safeRect.height === 0 ? 0 : Math.min(safeRect.height, positiveDimension(bounds.height));

  return {
    x: clamp(Math.round(finiteCoordinate(bounds.x)), safeRect.x, safeRect.x + Math.max(0, safeRect.width - width)),
    y: clamp(Math.round(finiteCoordinate(bounds.y)), safeRect.y, safeRect.y + Math.max(0, safeRect.height - height)),
    width,
    height,
  };
}

/** Fits a normal window to the full usable mobile WorkArea without adding a visual margin. */
export function fitWindowToMobileWorkArea(
  bounds: WindowBounds,
  workArea: WorkArea,
  minimumWidth = 1,
  minimumHeight = 1,
): WindowBounds {
  const availableWidth = Math.max(0, finiteDimension(workArea.width, 0));
  const availableHeight = Math.max(0, finiteDimension(workArea.height, 0));
  const minimum = {
    width: effectiveMinimum(minimumWidth, availableWidth),
    height: effectiveMinimum(minimumHeight, availableHeight),
  };
  const width = availableWidth === 0
    ? 0
    : Math.min(availableWidth, Math.max(minimum.width, positiveDimension(bounds.width)));
  const height = availableHeight === 0
    ? 0
    : Math.min(availableHeight, Math.max(minimum.height, positiveDimension(bounds.height)));
  const areaX = finiteCoordinate(workArea.x);
  const areaY = finiteCoordinate(workArea.y);

  return {
    x: clamp(Math.round(finiteCoordinate(bounds.x)), areaX, areaX + Math.max(0, availableWidth - width)),
    y: clamp(Math.round(finiteCoordinate(bounds.y)), areaY, areaY + Math.max(0, availableHeight - height)),
    width,
    height,
  };
}

/** Fits and centers a preferred normal window in the mobile safe rect. */
export function centerWindowInMobileSafeRect(
  bounds: WindowBounds,
  workArea: WorkArea,
  minimumWidth = 1,
  minimumHeight = 1,
): WindowBounds {
  const safeRect = getMobileWindowSafeRect(workArea);
  const size = resolveMobileSize(bounds, safeRect, minimumWidth, minimumHeight);

  return {
    x: Math.round(safeRect.x + (safeRect.width - size.width) / 2),
    y: Math.round(safeRect.y + (safeRect.height - size.height) / 2),
    width: size.width,
    height: size.height,
  };
}

const hasDirection = (direction: ResizeDirection, token: "n" | "e" | "s" | "w"): boolean =>
  direction.includes(token);

export interface MobileResizeWindowOptions {
  readonly initialBounds: WindowBounds;
  readonly direction: ResizeDirection;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly minimumWidth: number;
  readonly minimumHeight: number;
  readonly workArea: WorkArea;
}

/** Resizes a normal window while keeping its complete outer shell in the mobile safe rect. */
export function resizeMobileWindowBounds({
  initialBounds,
  direction,
  deltaX,
  deltaY,
  minimumWidth,
  minimumHeight,
  workArea,
}: MobileResizeWindowOptions): WindowBounds {
  const safeRect = getMobileWindowSafeRect(workArea);
  const initial = clampWindowToMobileSafeRect(initialBounds, workArea, minimumWidth, minimumHeight);
  const minimum = getMobileEffectiveMinimumSize(minimumWidth, minimumHeight, safeRect);
  const safeRight = safeRect.x + safeRect.width;
  const safeBottom = safeRect.y + safeRect.height;
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const initialRight = initial.x + initial.width;
  const initialBottom = initial.y + initial.height;

  let x = initial.x;
  let y = initial.y;
  let width = initial.width;
  let height = initial.height;

  if (hasDirection(direction, "e")) {
    const right = clamp(initialRight + safeDeltaX, initial.x + minimum.width, safeRight);
    width = Math.max(0, right - initial.x);
  }

  if (hasDirection(direction, "w")) {
    x = clamp(initial.x + safeDeltaX, safeRect.x, initialRight - minimum.width);
    width = Math.max(0, initialRight - x);
  }

  if (hasDirection(direction, "s")) {
    const bottom = clamp(initialBottom + safeDeltaY, initial.y + minimum.height, safeBottom);
    height = Math.max(0, bottom - initial.y);
  }

  if (hasDirection(direction, "n")) {
    y = clamp(initial.y + safeDeltaY, safeRect.y, initialBottom - minimum.height);
    height = Math.max(0, initialBottom - y);
  }

  return clampWindowToMobileSafeRect(
    { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) },
    workArea,
    minimumWidth,
    minimumHeight,
  );
}
