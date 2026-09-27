import { describe, expect, it } from "vitest";
import { hideAllKCalcOptionalPanels, showAllKCalcOptionalPanels, toggleKCalcOptionalPanel } from "./kcalcOptionalPanels";
import {
  KCALC_BASE_WINDOW_HEIGHT,
  KCALC_BASE_WINDOW_WIDTH,
  KCALC_OPTIONAL_COLUMN_GAP,
  KCALC_OPTIONAL_COLUMN_WIDTH,
  getKCalcContentFitWidth,
  getKCalcNaturalSize,
  getKCalcRequiredWidth,
  kcalcOptionalPanelWidthContributions,
} from "./kcalcLayoutGeometry";

describe("KCalc optional panel geometry", () => {
  it("derives required widths additively from independent module contributions", () => {
    const hidden = hideAllKCalcOptionalPanels();
    const science = toggleKCalcOptionalPanel(hidden, "scienceEngineering");
    const statistics = toggleKCalcOptionalPanel(hidden, "statistics");
    const logic = toggleKCalcOptionalPanel(hidden, "logic");
    const constants = toggleKCalcOptionalPanel(hidden, "constants");
    const scienceAndConstants = toggleKCalcOptionalPanel(science, "constants");

    expect(KCALC_OPTIONAL_COLUMN_WIDTH + KCALC_OPTIONAL_COLUMN_GAP).toBe(38);
    expect(getKCalcRequiredWidth(hidden)).toBe(KCALC_BASE_WINDOW_WIDTH);
    expect(getKCalcRequiredWidth(science)).toBe(KCALC_BASE_WINDOW_WIDTH + kcalcOptionalPanelWidthContributions.scienceEngineering);
    expect(getKCalcRequiredWidth(statistics)).toBe(KCALC_BASE_WINDOW_WIDTH + kcalcOptionalPanelWidthContributions.statistics);
    expect(getKCalcRequiredWidth(logic)).toBe(KCALC_BASE_WINDOW_WIDTH + kcalcOptionalPanelWidthContributions.logic);
    expect(getKCalcRequiredWidth(constants)).toBe(KCALC_BASE_WINDOW_WIDTH + kcalcOptionalPanelWidthContributions.constants);
    expect(getKCalcRequiredWidth(scienceAndConstants)).toBe(
      KCALC_BASE_WINDOW_WIDTH + kcalcOptionalPanelWidthContributions.scienceEngineering + kcalcOptionalPanelWidthContributions.constants,
    );
    expect(getKCalcRequiredWidth(showAllKCalcOptionalPanels())).toBe(463);
  });

  it("uses the same required width regardless of panel toggle order", () => {
    const scienceThenLogic = toggleKCalcOptionalPanel(
      toggleKCalcOptionalPanel(hideAllKCalcOptionalPanels(), "scienceEngineering"),
      "logic",
    );
    const logicThenScience = toggleKCalcOptionalPanel(
      toggleKCalcOptionalPanel(hideAllKCalcOptionalPanels(), "logic"),
      "scienceEngineering",
    );

    expect(getKCalcRequiredWidth(scienceThenLogic)).toBe(getKCalcRequiredWidth(logicThenScience));
  });

  it("derives exact natural sizes for all sixteen optional-panel layouts", () => {
    const panels = ["scienceEngineering", "statistics", "logic", "constants"] as const;

    for (let mask = 0; mask < 16; mask += 1) {
      const layout = panels.reduce((current, panel, index) => ({
        ...current,
        [panel]: (mask & (1 << index)) !== 0,
      }), hideAllKCalcOptionalPanels());
      const expectedWidth = KCALC_BASE_WINDOW_WIDTH + panels.reduce(
        (width, panel) => width + (layout[panel] ? kcalcOptionalPanelWidthContributions[panel] : 0),
        0,
      );

      expect(getKCalcNaturalSize(layout)).toEqual({ width: expectedWidth, height: KCALC_BASE_WINDOW_HEIGHT });
    }
  });

  it("always returns the exact deterministic natural width for a changed optional layout", () => {
    expect(getKCalcContentFitWidth(273, 311)).toBe(311);
    expect(getKCalcContentFitWidth(600, 348)).toBe(348);
    expect(getKCalcContentFitWidth(500, 424)).toBe(424);
    expect(getKCalcContentFitWidth(400, 500)).toBe(500);
    expect(getKCalcContentFitWidth(463, 463)).toBeNull();
  });
});
