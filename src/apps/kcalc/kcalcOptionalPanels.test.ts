import { describe, expect, it } from "vitest";
import {
  hideAllKCalcOptionalPanels,
  initialKCalcOptionalPanels,
  showAllKCalcOptionalPanels,
  toggleKCalcOptionalPanel,
} from "./kcalcOptionalPanels";

describe("KCalc optional button panels", () => {
  it("starts at Hide All and toggles each optional panel independently", () => {
    expect(initialKCalcOptionalPanels).toEqual({
      scienceEngineering: false,
      statistics: false,
      logic: false,
      constants: false,
    });

    const science = toggleKCalcOptionalPanel(initialKCalcOptionalPanels, "scienceEngineering");
    const statistics = toggleKCalcOptionalPanel(initialKCalcOptionalPanels, "statistics");
    const logic = toggleKCalcOptionalPanel(initialKCalcOptionalPanels, "logic");
    const constants = toggleKCalcOptionalPanel(initialKCalcOptionalPanels, "constants");

    expect(science).toEqual({ ...initialKCalcOptionalPanels, scienceEngineering: true });
    expect(statistics).toEqual({ ...initialKCalcOptionalPanels, statistics: true });
    expect(logic).toEqual({ ...initialKCalcOptionalPanels, logic: true });
    expect(constants).toEqual({ ...initialKCalcOptionalPanels, constants: true });
  });

  it("composes arbitrary panel combinations without changing unrelated panel flags", () => {
    const scienceAndConstants = toggleKCalcOptionalPanel(
      toggleKCalcOptionalPanel(initialKCalcOptionalPanels, "scienceEngineering"),
      "constants",
    );
    const statisticsAndLogic = toggleKCalcOptionalPanel(
      toggleKCalcOptionalPanel(initialKCalcOptionalPanels, "statistics"),
      "logic",
    );

    expect(scienceAndConstants).toEqual({ scienceEngineering: true, statistics: false, logic: false, constants: true });
    expect(statisticsAndLogic).toEqual({ scienceEngineering: false, statistics: true, logic: true, constants: false });
  });

  it("supports Show All followed by an individual toggle and Hide All followed by an individual toggle", () => {
    const all = showAllKCalcOptionalPanels();
    const allExceptLogic = toggleKCalcOptionalPanel(all, "logic");
    const hiddenThenScience = toggleKCalcOptionalPanel(hideAllKCalcOptionalPanels(), "scienceEngineering");

    expect(all).toEqual({ scienceEngineering: true, statistics: true, logic: true, constants: true });
    expect(allExceptLogic).toEqual({ scienceEngineering: true, statistics: true, logic: false, constants: true });
    expect(hiddenThenScience).toEqual({ scienceEngineering: true, statistics: false, logic: false, constants: false });
  });
});
