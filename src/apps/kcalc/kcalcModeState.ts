import type { KCalcOptionalPanels } from "./kcalcOptionalPanels";

export type KCalcAngleUnit = "degrees" | "radians" | "gradians";

export type KCalcNumberBase = "hex" | "decimal" | "octal" | "binary";

export type KCalcModeState = Readonly<{
  inverse: boolean;
  hyp: boolean;
  angleUnit: KCalcAngleUnit;
  numberBase: KCalcNumberBase;
}>;

export type KCalcModeCommandId = "hyp";

export type KCalcStatusIndicators = Readonly<{
  mode: "NORM" | "INV";
  memory: "" | "M";
  angle: "" | "DEG" | "RAD" | "GRA";
  base: "" | "HEX" | "DEC" | "OCT" | "BIN";
}>;

export const initialKCalcModeState: KCalcModeState = Object.freeze({
  inverse: false,
  hyp: false,
  angleUnit: "degrees",
  numberBase: "decimal",
});

export const kcalcAngleMenuItems = Object.freeze([
  { unit: "degrees", label: "Degrees" },
  { unit: "radians", label: "Radians" },
  { unit: "gradians", label: "Gradians" },
] as const satisfies readonly { readonly unit: KCalcAngleUnit; readonly label: string }[]);

export const kcalcBaseSelectorItems = Object.freeze([
  { base: "hex", label: "Hex" },
  { base: "decimal", label: "Dec" },
  { base: "octal", label: "Oct" },
  { base: "binary", label: "Bin" },
] as const satisfies readonly { readonly base: KCalcNumberBase; readonly label: string }[]);

const angleStatusLabels: Readonly<Record<KCalcAngleUnit, KCalcStatusIndicators["angle"]>> = {
  degrees: "DEG",
  radians: "RAD",
  gradians: "GRA",
};

const baseStatusLabels: Readonly<Record<KCalcNumberBase, KCalcStatusIndicators["base"]>> = {
  hex: "HEX",
  decimal: "DEC",
  octal: "OCT",
  binary: "BIN",
};

export function toggleKCalcInverse(mode: KCalcModeState): KCalcModeState {
  return { ...mode, inverse: !mode.inverse };
}

export function clearKCalcInverse(mode: KCalcModeState): KCalcModeState {
  return mode.inverse ? { ...mode, inverse: false } : mode;
}

export function toggleKCalcHyp(mode: KCalcModeState): KCalcModeState {
  return { ...mode, hyp: !mode.hyp };
}

export function isKCalcModeCommand(commandId: string): commandId is KCalcModeCommandId {
  return commandId === "hyp";
}

export function applyKCalcModeCommand(mode: KCalcModeState, commandId: KCalcModeCommandId): KCalcModeState {
  switch (commandId) {
    case "hyp":
      return toggleKCalcHyp(mode);
  }
}

export function setKCalcAngleUnit(mode: KCalcModeState, angleUnit: KCalcAngleUnit): KCalcModeState {
  return mode.angleUnit === angleUnit ? mode : { ...mode, angleUnit };
}

export function setKCalcNumberBase(mode: KCalcModeState, numberBase: KCalcNumberBase): KCalcModeState {
  return mode.numberBase === numberBase ? mode : { ...mode, numberBase };
}

export function getKCalcStatusIndicators(
  mode: KCalcModeState,
  panels: KCalcOptionalPanels,
  memoryValue: number | null = null,
): KCalcStatusIndicators {
  return {
    mode: mode.inverse ? "INV" : "NORM",
    memory: memoryValue === null ? "" : "M",
    angle: panels.scienceEngineering ? angleStatusLabels[mode.angleUnit] : "",
    base: panels.logic ? baseStatusLabels[mode.numberBase] : "",
  };
}
