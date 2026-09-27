export type KMenuPopupGeometryInput = {
  /** All values are CSS logical pixels, before the desktop shell zoom. */
  readonly viewportHeight: number;
  readonly kickerTop: number;
  readonly naturalHeight: number;
  readonly workAreaTop?: number;
};

export type KMenuPopupGeometry = {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly needsScroll: boolean;
};

/**
 * Computes the containment policy for the menu popup. CSS owns the final
 * flex/scroll layout; this helper keeps the logical geometry contract
 * explicit and testable without relying on browser layout measurements.
 */
export function getKMenuPopupGeometry({
  viewportHeight,
  kickerTop,
  naturalHeight,
  workAreaTop = 0,
}: KMenuPopupGeometryInput): KMenuPopupGeometry {
  const safeViewportHeight = Math.max(0, viewportHeight);
  const bottom = Math.min(safeViewportHeight, Math.max(workAreaTop, kickerTop));
  const availableHeight = Math.max(0, bottom - workAreaTop);
  const safeNaturalHeight = Math.max(0, naturalHeight);
  const height = Math.min(safeNaturalHeight, availableHeight);

  return {
    top: bottom - height,
    bottom,
    height,
    needsScroll: safeNaturalHeight > height,
  };
}
