import type { KCalcOptionalPanels } from "./kcalcOptionalPanels";

export const KCALC_BASE_WINDOW_WIDTH = 273;
export const KCALC_BASE_WINDOW_HEIGHT = 282;
export const KCALC_OPTIONAL_COLUMN_WIDTH = 35;
export const KCALC_OPTIONAL_COLUMN_GAP = 3;

const optionalColumnContribution = KCALC_OPTIONAL_COLUMN_WIDTH + KCALC_OPTIONAL_COLUMN_GAP;

export const kcalcOptionalPanelWidthContributions = Object.freeze({
  scienceEngineering: optionalColumnContribution,
  statistics: optionalColumnContribution,
  logic: optionalColumnContribution * 2,
  constants: optionalColumnContribution,
}) satisfies Readonly<Record<keyof KCalcOptionalPanels, number>>;

export function getKCalcRequiredWidth(panels: KCalcOptionalPanels): number {
  return KCALC_BASE_WINDOW_WIDTH + (Object.keys(kcalcOptionalPanelWidthContributions) as (keyof KCalcOptionalPanels)[])
    .reduce((width, panel) => width + (panels[panel] ? kcalcOptionalPanelWidthContributions[panel] : 0), 0);
}

export function getKCalcNaturalSize(panels: KCalcOptionalPanels): Readonly<{ width: number; height: number }> {
  return {
    width: getKCalcRequiredWidth(panels),
    height: KCALC_BASE_WINDOW_HEIGHT,
  };
}

export function getKCalcContentFitWidth(
  currentWidth: number,
  requiredWidth: number,
): number | null {
  return currentWidth === requiredWidth ? null : requiredWidth;
}
