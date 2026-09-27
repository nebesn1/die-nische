import { describe, expect, it } from "vitest";
import { initialKCalcOptionalPanels, showAllKCalcOptionalPanels } from "./kcalcOptionalPanels";
import {
  getKCalcStatusIndicators,
  clearKCalcInverse,
  initialKCalcModeState,
  applyKCalcModeCommand,
  setKCalcAngleUnit,
  setKCalcNumberBase,
  toggleKCalcHyp,
  toggleKCalcInverse,
} from "./kcalcModeState";

describe("KCalc mode state", () => {
  it("starts as independent NORM, Degrees, Decimal state", () => {
    expect(initialKCalcModeState).toEqual({
      inverse: false,
      hyp: false,
      angleUnit: "degrees",
      numberBase: "decimal",
    });
    expect(getKCalcStatusIndicators(initialKCalcModeState, initialKCalcOptionalPanels)).toEqual({
      mode: "NORM",
      memory: "",
      angle: "",
      base: "",
    });
  });

  it("updates inverse, hyp, angle, and base without resetting the other modes", () => {
    const inverse = toggleKCalcInverse(initialKCalcModeState);
    const hyperbolic = toggleKCalcHyp(inverse);
    const radians = setKCalcAngleUnit(hyperbolic, "radians");
    const hexadecimal = setKCalcNumberBase(radians, "hex");

    expect(hexadecimal).toEqual({
      inverse: true,
      hyp: true,
      angleUnit: "radians",
      numberBase: "hex",
    });
    expect(getKCalcStatusIndicators(hexadecimal, showAllKCalcOptionalPanels())).toEqual({
      mode: "INV",
      memory: "",
      angle: "RAD",
      base: "HEX",
    });
  });

  it("clears only INV while retaining persistent hyp, angle, and base state", () => {
    const active = setKCalcNumberBase(
      setKCalcAngleUnit(toggleKCalcHyp(toggleKCalcInverse(initialKCalcModeState)), "radians"),
      "hex",
    );

    expect(clearKCalcInverse(active)).toEqual({
      inverse: false,
      hyp: true,
      angleUnit: "radians",
      numberBase: "hex",
    });
  });

  it("toggles Hyp as an instance-local persistent mode command without changing angle or base", () => {
    const configured = setKCalcNumberBase(setKCalcAngleUnit(initialKCalcModeState, "gradians"), "binary");
    const enabled = applyKCalcModeCommand(configured, "hyp");

    expect(enabled).toEqual({
      inverse: false,
      hyp: true,
      angleUnit: "gradians",
      numberBase: "binary",
    });
    expect(applyKCalcModeCommand(enabled, "hyp")).toEqual(configured);
  });

  it("retains hidden angle and base choices while only their status slots become blank", () => {
    const mode = setKCalcNumberBase(
      setKCalcAngleUnit(initialKCalcModeState, "gradians"),
      "binary",
    );

    expect(getKCalcStatusIndicators(mode, {
      ...initialKCalcOptionalPanels,
      scienceEngineering: true,
    })).toEqual({ mode: "NORM", memory: "", angle: "GRA", base: "" });
    expect(getKCalcStatusIndicators(mode, {
      ...initialKCalcOptionalPanels,
      logic: true,
    })).toEqual({ mode: "NORM", memory: "", angle: "", base: "BIN" });
    expect(getKCalcStatusIndicators(mode, showAllKCalcOptionalPanels())).toEqual({
      mode: "NORM",
      memory: "",
      angle: "GRA",
      base: "BIN",
    });
  });

  it("derives the fixed Memory status directly from a non-null register, including stored zero", () => {
    expect(getKCalcStatusIndicators(initialKCalcModeState, initialKCalcOptionalPanels, null)).toMatchObject({ memory: "" });
    expect(getKCalcStatusIndicators(initialKCalcModeState, initialKCalcOptionalPanels, 0)).toMatchObject({ memory: "M" });
    expect(getKCalcStatusIndicators(initialKCalcModeState, showAllKCalcOptionalPanels(), 20)).toEqual({
      mode: "NORM",
      memory: "M",
      angle: "DEG",
      base: "DEC",
    });
  });
});
