import { clampWindowBounds } from "../window-manager/geometry";
import { clampWindowToMobileSafeRect } from "../window-manager/responsiveGeometry";
import type { WindowBounds, WindowLayoutMode, WorkArea } from "../window-manager/types";

export const CASCADE_OFFSET = 24;
export const CASCADE_EDGE_MARGIN = CASCADE_OFFSET;

export interface CascadePlacementOptions {
  readonly cascadeOffset?: number;
  readonly edgeMargin?: number;
}

const getSafeCoordinate = (value: number): number => Number.isFinite(value) ? value : 0;
const getSafeDimension = (value: number): number => Number.isFinite(value) ? Math.max(1, value) : 1;
const getSafeWorkAreaDimension = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0;
const getSafeNonNegativeInteger = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const getSafeWorkArea = (workArea: WorkArea): WorkArea => ({
  x: getSafeCoordinate(workArea.x),
  y: getSafeCoordinate(workArea.y),
  width: getSafeWorkAreaDimension(workArea.width),
  height: getSafeWorkAreaDimension(workArea.height),
  titleBarHeight: getSafeDimension(workArea.titleBarHeight),
});

const getCanonicalBaseBounds = (baseBounds: WindowBounds, workArea: WorkArea): WindowBounds => {
  return clampWindowBounds(
    {
      x: getSafeCoordinate(baseBounds.x),
      y: getSafeCoordinate(baseBounds.y),
      width: getSafeDimension(baseBounds.width),
      height: getSafeDimension(baseBounds.height),
    },
    workArea,
  );
};

const getCanonicalMobileBaseBounds = (baseBounds: WindowBounds, workArea: WorkArea): WindowBounds =>
  clampWindowToMobileSafeRect(baseBounds, workArea);

const getCascadeGeometry = (options: CascadePlacementOptions): { readonly offset: number; readonly edgeMargin: number } => ({
  offset: getSafeNonNegativeInteger(options.cascadeOffset ?? CASCADE_OFFSET),
  edgeMargin: getSafeNonNegativeInteger(options.edgeMargin ?? CASCADE_EDGE_MARGIN),
});

/**
 * Counts centered slot zero plus every down-right candidate that preserves one
 * cascade step of clearance from the Work Area's right and bottom boundaries.
 */
export function getAdaptiveCascadeCapacity(
  baseBounds: WindowBounds,
  workArea: WorkArea,
  options: CascadePlacementOptions = {},
): number {
  const safeWorkArea = getSafeWorkArea(workArea);
  const canonicalBaseBounds = getCanonicalBaseBounds(baseBounds, safeWorkArea);
  const { offset, edgeMargin } = getCascadeGeometry(options);

  if (offset <= 0) {
    return 1;
  }

  const availableHorizontalDistance = safeWorkArea.x + safeWorkArea.width - edgeMargin
    - (canonicalBaseBounds.x + canonicalBaseBounds.width);
  const availableVerticalDistance = safeWorkArea.y + safeWorkArea.height - edgeMargin
    - (canonicalBaseBounds.y + canonicalBaseBounds.height);
  const safeSteps = Math.max(
    0,
    Math.min(
      Math.floor(availableHorizontalDistance / offset),
      Math.floor(availableVerticalDistance / offset),
    ),
  );

  return safeSteps + 1;
}

/** Maps a monotonic Runtime serial onto the current geometry-derived visual track. */
export function getCascadeVisualSlot(cascadeSerial: number, capacity: number): number {
  const safeCapacity = Math.max(1, getSafeNonNegativeInteger(capacity));
  const safeSerial = getSafeNonNegativeInteger(cascadeSerial);

  return safeSerial % safeCapacity;
}

/** Resolves one bounded visual cascade position without changing Runtime serial allocation. */
export function getCascadedApplicationBounds(
  baseBounds: WindowBounds,
  cascadeSerial: number,
  workArea: WorkArea,
  layoutMode: WindowLayoutMode = "desktop",
): WindowBounds {
  const safeWorkArea = getSafeWorkArea(workArea);
  const canonicalBaseBounds = layoutMode === "mobile"
    ? getCanonicalMobileBaseBounds(baseBounds, safeWorkArea)
    : getCanonicalBaseBounds(baseBounds, safeWorkArea);
  const capacity = getAdaptiveCascadeCapacity(canonicalBaseBounds, safeWorkArea);
  const visualSlot = getCascadeVisualSlot(cascadeSerial, capacity);
  const offset = visualSlot * CASCADE_OFFSET;

  const cascadedBounds = {
    ...canonicalBaseBounds,
    x: canonicalBaseBounds.x + offset,
    y: canonicalBaseBounds.y + offset,
  };

  return layoutMode === "mobile"
    ? clampWindowToMobileSafeRect(cascadedBounds, safeWorkArea)
    : clampWindowBounds(cascadedBounds, safeWorkArea);
}
