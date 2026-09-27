import { clampWindowBounds } from "../window-manager/geometry";
import { centerWindowInMobileSafeRect } from "../window-manager/responsiveGeometry";
import type { WindowBounds, WindowLayoutMode, WorkArea } from "../window-manager/types";
import type { ApplicationDefinition } from "./types";

const getEffectiveMinimum = (declaredMinimum: number, workAreaSize: number): number => {
  return Math.max(1, Math.min(Math.max(1, declaredMinimum), Math.max(1, workAreaSize)));
};

const resolveInitialHeight = (definition: ApplicationDefinition, workArea: WorkArea): number => {
  const preferredHeight = definition.window.bounds.height;
  const ratio = definition.window.initialSizing?.maximumWorkAreaHeightRatio;

  if (ratio === undefined) {
    return Math.max(1, Math.round(preferredHeight));
  }

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return Math.max(1, Math.round(preferredHeight));
  }

  const safeWorkAreaHeight = Math.max(0, workArea.height);
  const ratioMaximumHeight = Math.floor(safeWorkAreaHeight * ratio);
  const effectiveMinimumHeight = getEffectiveMinimum(definition.window.minimumHeight, safeWorkAreaHeight);

  return Math.max(
    effectiveMinimumHeight,
    Math.min(Math.round(preferredHeight), ratioMaximumHeight, safeWorkAreaHeight),
  );
};

export function resolveApplicationInitialBounds(
  definition: ApplicationDefinition,
  workArea: WorkArea,
  layoutMode: WindowLayoutMode = "desktop",
): WindowBounds {
  const preferredBounds = definition.window.bounds;

  const resolvedSize = clampWindowBounds(
    {
      ...preferredBounds,
      x: workArea.x,
      y: workArea.y,
      height: resolveInitialHeight(definition, workArea),
    },
    workArea,
  );

  return layoutMode === "mobile"
    ? centerWindowInMobileSafeRect(
      resolvedSize,
      workArea,
      definition.window.minimumWidth,
      definition.window.minimumHeight,
    )
    : getCenteredWindowBounds(workArea, resolvedSize);
}

/** Centers already-resolved initial dimensions within the usable desktop area. */
export function getCenteredWindowBounds(workArea: WorkArea, size: WindowBounds): WindowBounds {
  return clampWindowBounds(
    {
      ...size,
      x: workArea.x + (workArea.width - size.width) / 2,
      y: workArea.y + (workArea.height - size.height) / 2,
    },
    workArea,
  );
}
