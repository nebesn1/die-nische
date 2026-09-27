import type { ResizeDirection, ScreenArea, WindowBounds, WorkArea } from "./types";

export interface NormalResizeWindowOptions {
  initialBounds: WindowBounds;
  direction: ResizeDirection;
  deltaX: number;
  deltaY: number;
  minimumWidth: number;
  minimumHeight: number;
  screenArea: ScreenArea;
}

export interface WindowFrameEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const clamp = (value: number, min: number, max: number): number => {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
};

/** Width of draggable titlebar that must remain on screen for recovery. */
export const MIN_VISIBLE_TITLEBAR_WIDTH = 64;

export function clampWindowBounds(bounds: WindowBounds, workArea: WorkArea): WindowBounds {
  const titleBarVisibleHeight = Math.min(bounds.height, workArea.titleBarHeight);
  const smallestVisibleWidth = Math.min(bounds.width, workArea.width);

  const minX = workArea.x;
  const maxX =
    bounds.width <= workArea.width
      ? workArea.x + workArea.width - bounds.width
      : workArea.x + workArea.width - smallestVisibleWidth;

  const minY = workArea.y;
  const maxY =
    bounds.height <= workArea.height
      ? workArea.y + workArea.height - bounds.height
      : workArea.y + workArea.height - titleBarVisibleHeight;

  return {
    ...bounds,
    x: clamp(Math.round(bounds.x), minX, maxX),
    y: clamp(Math.round(bounds.y), minY, maxY),
  };
}

/**
 * Normal windows may leave the screen horizontally and extend behind Kicker,
 * but keep a usable titlebar strip in view. Initial placement and maximize do
 * not use this recovery policy.
 */
export function clampNormalWindowDragBounds(
  bounds: WindowBounds,
  screenArea: ScreenArea,
  workArea: WorkArea,
): WindowBounds {
  const safeWidth = Math.max(1, bounds.width);
  const safeHeight = Math.max(1, bounds.height);
  const recoveryWidth = Math.min(safeWidth, MIN_VISIBLE_TITLEBAR_WIDTH);
  const screenRight = screenArea.x + Math.max(0, screenArea.width);
  const workAreaBottom = workArea.y + Math.max(0, workArea.height);
  const titlebarHeight = Math.min(safeHeight, Math.max(1, workArea.titleBarHeight));
  const minX = screenArea.x - safeWidth + recoveryWidth;
  const maxX = screenRight - recoveryWidth;
  const minY = screenArea.y;
  const maxY = Math.max(minY, workAreaBottom - titlebarHeight);

  return {
    ...bounds,
    x: clamp(Math.round(bounds.x), minX, maxX),
    y: clamp(Math.round(bounds.y), minY, maxY),
  };
}

export function moveWindowBounds(
  bounds: WindowBounds,
  x: number,
  y: number,
  screenArea: ScreenArea,
  workArea: WorkArea,
): WindowBounds {
  return clampNormalWindowDragBounds({ ...bounds, x, y }, screenArea, workArea);
}

export function getMaximizedBounds(workArea: WorkArea): WindowBounds {
  return {
    x: workArea.x,
    y: workArea.y,
    width: Math.max(0, workArea.width),
    height: Math.max(0, workArea.height),
  };
}

/**
 * Resolves a logical outer frame to the four edges of its WorkArea containing
 * block. CSS can then preserve both edges through fractional UI-scale layout
 * instead of independently rounding a translated position and a size.
 */
export function getWindowFrameEdges(bounds: WindowBounds, workArea: WorkArea): WindowFrameEdges {
  const areaX = Number.isFinite(workArea.x) ? workArea.x : 0;
  const areaY = Number.isFinite(workArea.y) ? workArea.y : 0;
  const areaWidth = Number.isFinite(workArea.width) ? Math.max(0, workArea.width) : 0;
  const areaHeight = Number.isFinite(workArea.height) ? Math.max(0, workArea.height) : 0;
  const x = Number.isFinite(bounds.x) ? bounds.x : areaX;
  const y = Number.isFinite(bounds.y) ? bounds.y : areaY;
  const width = Number.isFinite(bounds.width) ? Math.max(0, bounds.width) : 0;
  const height = Number.isFinite(bounds.height) ? Math.max(0, bounds.height) : 0;

  return {
    left: x - areaX,
    top: y - areaY,
    right: areaWidth - (x - areaX) - width,
    bottom: areaHeight - (y - areaY) - height,
  };
}

const hasDirection = (direction: ResizeDirection, token: "n" | "e" | "s" | "w"): boolean => {
  return direction.includes(token);
};

const getSafeDimension = (value: number): number => {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
};

const getSafeCoordinate = (value: number): number => {
  return Number.isFinite(value) ? value : 0;
};

const getSafeDelta = (value: number): number => {
  return Number.isFinite(value) ? value : 0;
};

const getMinimumWidthForFixedLeftEdge = (x: number, screenArea: ScreenArea): number => {
  if (x >= screenArea.x) {
    return 1;
  }

  return screenArea.x + MIN_VISIBLE_TITLEBAR_WIDTH - x;
};

/**
 * Resizes a normal window without imposing the WorkArea's right or bottom
 * boundary. Unlike titlebar movement, each direction keeps its opposite edge
 * anchored whenever that remains compatible with the recovery contract.
 */
export function resizeNormalWindowBounds({
  initialBounds,
  direction,
  deltaX,
  deltaY,
  minimumWidth,
  minimumHeight,
  screenArea,
}: NormalResizeWindowOptions): WindowBounds {
  const initialX = getSafeCoordinate(initialBounds.x);
  const initialY = getSafeCoordinate(initialBounds.y);
  const initialWidth = getSafeDimension(initialBounds.width);
  const initialHeight = getSafeDimension(initialBounds.height);
  const initialRight = initialX + initialWidth;
  const initialBottom = initialY + initialHeight;
  const effectiveMinimumWidth = getSafeDimension(minimumWidth);
  const effectiveMinimumHeight = getSafeDimension(minimumHeight);
  const minimumWidthWithRecovery = Math.max(
    effectiveMinimumWidth,
    getMinimumWidthForFixedLeftEdge(initialX, screenArea),
  );
  const safeDeltaX = getSafeDelta(deltaX);
  const safeDeltaY = getSafeDelta(deltaY);

  let x = initialX;
  let y = initialY;
  let width = initialWidth;
  let height = initialHeight;

  if (hasDirection(direction, "e")) {
    const desiredRight = initialRight + safeDeltaX;
    width = Math.max(minimumWidthWithRecovery, desiredRight - initialX);
  }

  if (hasDirection(direction, "w")) {
    const desiredX = initialX + safeDeltaX;
    const maxX = initialRight - effectiveMinimumWidth;
    x = Math.min(desiredX, maxX);
    width = initialRight - x;
  }

  if (hasDirection(direction, "s")) {
    const desiredBottom = initialBottom + safeDeltaY;
    height = Math.max(effectiveMinimumHeight, desiredBottom - initialY);
  }

  if (hasDirection(direction, "n")) {
    const desiredY = initialY + safeDeltaY;
    const maxY = initialBottom - effectiveMinimumHeight;
    y = clamp(desiredY, screenArea.y, maxY);
    height = initialBottom - y;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}
