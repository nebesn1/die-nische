import type { KCalcModeState } from "./kcalcModeState";

export type KCalcCommandId =
  | "sin"
  | "asin"
  | "sinh"
  | "asinh"
  | "cos"
  | "acos"
  | "cosh"
  | "acosh"
  | "tan"
  | "atan"
  | "tanh"
  | "atanh"
  | "log10"
  | "pow10"
  | "ln"
  | "exp"
  | "hyp"
  | "stat-count"
  | "stat-sum"
  | "stat-mean"
  | "stat-sum-squares"
  | "stat-sample-standard-deviation"
  | "stat-population-standard-deviation"
  | "stat-median"
  | "stat-enter-data"
  | "stat-delete-data"
  | "stat-clear"
  | "stat-clear-inverse-noop"
  | "logic-and"
  | "logic-or"
  | "logic-xor"
  | "logic-left-shift"
  | "logic-right-shift"
  | "logic-complement"
  | "mod"
  | "int-div"
  | "reciprocal"
  | "factorial"
  | "square"
  | "cube"
  | "sqrt"
  | "cuberoot"
  | "power"
  | "inverse-power"
  | "scientific-entry"
  | "percent"
  | "memory-recall"
  | "memory-store"
  | "memory-add"
  | "memory-subtract"
  | "memory-clear"
  | "constant-1"
  | "constant-2"
  | "constant-3"
  | "constant-4"
  | "constant-5"
  | "constant-6"
  | "store-constant-1"
  | "store-constant-2"
  | "store-constant-3"
  | "store-constant-4"
  | "store-constant-5"
  | "store-constant-6";

export type KCalcCommandLabel =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "superscript"; base: string; exponent: string }>
  | Readonly<{ kind: "sigma"; subscript: string }>
  | Readonly<{ kind: "sum"; exponent?: string }>;

export type KCalcCommandSurfaceDescriptor = Readonly<{
  label: KCalcCommandLabel;
  commandId: KCalcCommandId;
  ariaLabel: string;
  enabled: boolean;
  consumesInverse: boolean;
}>;

export type KCalcCommandSurfaceSlot = Readonly<{
  slotId: string;
  normal: KCalcCommandSurfaceDescriptor;
  inverse?: KCalcCommandSurfaceDescriptor;
}>;

export type KCalcScienceCommandSurfaceSlot = KCalcCommandSurfaceSlot & Readonly<{
  hyperbolic?: KCalcCommandSurfaceDescriptor;
  inverseHyperbolic?: KCalcCommandSurfaceDescriptor;
}>;

const disabled = false;

const text = (value: string): KCalcCommandLabel => ({ kind: "text", text: value });
const superscript = (base: string, exponent: string): KCalcCommandLabel => ({ kind: "superscript", base, exponent });
const sigma = (subscript: string): KCalcCommandLabel => ({ kind: "sigma", subscript });
const sum = (exponent?: string): KCalcCommandLabel => ({ kind: "sum", exponent });

const descriptor = (
  label: KCalcCommandLabel,
  commandId: KCalcCommandId,
  ariaLabel: string,
  consumesInverse = false,
): KCalcCommandSurfaceDescriptor => ({ label, commandId, ariaLabel, enabled: disabled, consumesInverse });

export const kcalcScienceCommandSlots = Object.freeze([
  {
    slotId: "science-hyp",
    normal: descriptor(text("Hyp"), "hyp", "Hyperbolic mode"),
  },
  {
    slotId: "science-sin",
    normal: descriptor(text("Sin"), "sin", "Sine"),
    inverse: descriptor(text("Asin"), "asin", "Arc sine", true),
    hyperbolic: descriptor(text("Sinh"), "sinh", "Hyperbolic sine"),
    inverseHyperbolic: descriptor(text("Asinh"), "asinh", "Inverse hyperbolic sine", true),
  },
  {
    slotId: "science-cos",
    normal: descriptor(text("Cos"), "cos", "Cosine"),
    inverse: descriptor(text("Acos"), "acos", "Arc cosine", true),
    hyperbolic: descriptor(text("Cosh"), "cosh", "Hyperbolic cosine"),
    inverseHyperbolic: descriptor(text("Acosh"), "acosh", "Inverse hyperbolic cosine", true),
  },
  {
    slotId: "science-tan",
    normal: descriptor(text("Tan"), "tan", "Tangent"),
    inverse: descriptor(text("Atan"), "atan", "Arc tangent", true),
    hyperbolic: descriptor(text("Tanh"), "tanh", "Hyperbolic tangent"),
    inverseHyperbolic: descriptor(text("Atanh"), "atanh", "Inverse hyperbolic tangent", true),
  },
  {
    slotId: "science-log",
    normal: descriptor(text("Log"), "log10", "Logarithm base 10"),
    inverse: descriptor(superscript("10", "x"), "pow10", "10 to the power of x", true),
  },
  {
    slotId: "science-ln",
    normal: descriptor(text("Ln"), "ln", "Natural logarithm"),
    inverse: descriptor(superscript("e", "x"), "exp", "e to the power of x", true),
  },
] as const satisfies readonly KCalcScienceCommandSurfaceSlot[]);

export const kcalcStatisticsCommandSlots = Object.freeze([
  {
    slotId: "statistics-count",
    normal: descriptor(text("N"), "stat-count", "Number of data entered"),
    inverse: descriptor(sum(), "stat-sum", "Sum of data items", true),
  },
  {
    slotId: "statistics-mean",
    normal: descriptor(text("Mea"), "stat-mean", "Mean"),
    inverse: descriptor(sum("2"), "stat-sum-squares", "Sum of data items squared", true),
  },
  {
    slotId: "statistics-sample-standard-deviation",
    normal: descriptor(sigma("N−1"), "stat-sample-standard-deviation", "Sample standard deviation"),
    inverse: descriptor(sigma("N"), "stat-population-standard-deviation", "Population standard deviation", true),
  },
  {
    slotId: "statistics-median",
    normal: descriptor(text("Med"), "stat-median", "Median"),
    inverse: descriptor(text("Med"), "stat-median", "Median", true),
  },
  {
    slotId: "statistics-data",
    normal: descriptor(text("Dat"), "stat-enter-data", "Enter data"),
    inverse: descriptor(text("CDat"), "stat-delete-data", "Delete last data item", true),
  },
  {
    slotId: "statistics-clear",
    normal: descriptor(text("CSt"), "stat-clear", "Clear statistics"),
    inverse: descriptor(text("CSt"), "stat-clear-inverse-noop", "Exit inverse without clearing statistics", true),
  },
] as const satisfies readonly KCalcCommandSurfaceSlot[]);

export const kcalcLogicCommandSlots = Object.freeze([
  {
    slotId: "logic-and",
    normal: descriptor(text("AND"), "logic-and", "Bitwise AND"),
    inverse: descriptor(text("AND"), "logic-and", "Bitwise AND", true),
  },
  {
    slotId: "logic-or",
    normal: descriptor(text("OR"), "logic-or", "Bitwise OR"),
    inverse: descriptor(text("OR"), "logic-or", "Bitwise OR", true),
  },
  {
    slotId: "logic-xor",
    normal: descriptor(text("XOR"), "logic-xor", "Bitwise XOR"),
    inverse: descriptor(text("XOR"), "logic-xor", "Bitwise XOR", true),
  },
  {
    slotId: "logic-left-shift",
    normal: descriptor(text("Lsh"), "logic-left-shift", "Left shift"),
    inverse: descriptor(text("Lsh"), "logic-left-shift", "Left shift", true),
  },
  {
    slotId: "logic-right-shift",
    normal: descriptor(text("Rsh"), "logic-right-shift", "Right shift"),
    inverse: descriptor(text("Rsh"), "logic-right-shift", "Right shift", true),
  },
  {
    slotId: "logic-complement",
    normal: descriptor(text("Cmp"), "logic-complement", "Bitwise complement"),
    inverse: descriptor(text("Cmp"), "logic-complement", "Bitwise complement", true),
  },
] as const satisfies readonly KCalcCommandSurfaceSlot[]);

export const kcalcBaseScientificCommandSlots = Object.freeze([
  {
    slotId: "base-mod",
    normal: descriptor(text("Mod"), "mod", "Modulo"),
    inverse: descriptor(text("IntDiv"), "int-div", "Integer division", true),
  },
  {
    slotId: "base-reciprocal",
    normal: descriptor(text("1/x"), "reciprocal", "Reciprocal"),
  },
  {
    slotId: "base-factorial",
    normal: descriptor(text("x!"), "factorial", "Factorial"),
  },
  {
    slotId: "base-square",
    normal: descriptor(text("x²"), "square", "Square"),
    inverse: descriptor(text("x³"), "cube", "Cube", true),
  },
  {
    slotId: "base-root",
    normal: descriptor(text("√x"), "sqrt", "Square root"),
    inverse: descriptor(text("∛x"), "cuberoot", "Cube root", true),
  },
  {
    slotId: "base-power",
    normal: descriptor(text("xʸ"), "power", "x to the power of y"),
    inverse: descriptor(superscript("x", "1/y"), "inverse-power", "x to the power of 1/y", true),
  },
] as const satisfies readonly KCalcCommandSurfaceSlot[]);

export const kcalcScientificEntryCommandSlot: KCalcCommandSurfaceSlot = Object.freeze({
  slotId: "scientific-entry",
  normal: descriptor(text("x·10ʸ"), "scientific-entry", "Scientific exponent entry"),
});

export const kcalcMemoryAddCommandSlot: KCalcCommandSurfaceSlot = Object.freeze({
  slotId: "memory-add",
  normal: descriptor(text("M+"), "memory-add", "Add to memory"),
  inverse: descriptor(text("M-"), "memory-subtract", "Subtract from memory", true),
});

export const kcalcMemoryRecallCommandSlot: KCalcCommandSurfaceSlot = Object.freeze({
  slotId: "memory-recall",
  normal: descriptor(text("MR"), "memory-recall", "Recall memory"),
});

export const kcalcMemoryStoreCommandSlot: KCalcCommandSurfaceSlot = Object.freeze({
  slotId: "memory-store",
  normal: descriptor(text("MS"), "memory-store", "Store memory"),
});

export const kcalcMemoryClearCommandSlot: KCalcCommandSurfaceSlot = Object.freeze({
  slotId: "memory-clear",
  normal: descriptor(text("MC"), "memory-clear", "Clear memory"),
});

export const kcalcPercentCommandSlot: KCalcCommandSurfaceSlot = Object.freeze({
  slotId: "percent",
  normal: descriptor(text("%"), "percent", "Percent"),
});

export const kcalcConstantsCommandSlots = Object.freeze([
  {
    slotId: "constant-1",
    normal: descriptor(text("C1"), "constant-1", "Constant 1"),
    inverse: descriptor(text("Store"), "store-constant-1", "Store constant 1", true),
  },
  {
    slotId: "constant-2",
    normal: descriptor(text("C2"), "constant-2", "Constant 2"),
    inverse: descriptor(text("Store"), "store-constant-2", "Store constant 2", true),
  },
  {
    slotId: "constant-3",
    normal: descriptor(text("C3"), "constant-3", "Constant 3"),
    inverse: descriptor(text("Store"), "store-constant-3", "Store constant 3", true),
  },
  {
    slotId: "constant-4",
    normal: descriptor(text("C4"), "constant-4", "Constant 4"),
    inverse: descriptor(text("Store"), "store-constant-4", "Store constant 4", true),
  },
  {
    slotId: "constant-5",
    normal: descriptor(text("C5"), "constant-5", "Constant 5"),
    inverse: descriptor(text("Store"), "store-constant-5", "Store constant 5", true),
  },
  {
    slotId: "constant-6",
    normal: descriptor(text("C6"), "constant-6", "Constant 6"),
    inverse: descriptor(text("Store"), "store-constant-6", "Store constant 6", true),
  },
] as const satisfies readonly KCalcCommandSurfaceSlot[]);

export function resolveKCalcCommandSurface(
  slot: KCalcCommandSurfaceSlot,
  inverse: boolean,
  isEnabled?: (commandId: KCalcCommandId) => boolean,
): KCalcCommandSurfaceDescriptor {
  const descriptor = inverse && slot.inverse !== undefined ? slot.inverse : slot.normal;

  if (isEnabled === undefined) {
    return descriptor;
  }

  return {
    ...descriptor,
    enabled: isEnabled(descriptor.commandId),
  };
}

export function resolveKCalcScienceCommandSurface(
  slot: KCalcScienceCommandSurfaceSlot,
  mode: Pick<KCalcModeState, "inverse" | "hyp">,
  isEnabled?: (commandId: KCalcCommandId) => boolean,
): KCalcCommandSurfaceDescriptor {
  const descriptor = mode.hyp
    ? mode.inverse && slot.inverseHyperbolic !== undefined
      ? slot.inverseHyperbolic
      : slot.hyperbolic ?? resolveKCalcCommandSurface(slot, mode.inverse)
    : resolveKCalcCommandSurface(slot, mode.inverse);

  if (isEnabled === undefined) {
    return descriptor;
  }

  return {
    ...descriptor,
    enabled: isEnabled(descriptor.commandId),
  };
}

export function getKCalcScienceSlotToggleState(
  slot: KCalcScienceCommandSurfaceSlot,
  mode: Pick<KCalcModeState, "hyp">,
): boolean | undefined {
  return slot.slotId === "science-hyp" ? mode.hyp : undefined;
}

export function getKCalcCommandLabelText(label: KCalcCommandLabel): string {
  switch (label.kind) {
    case "text":
      return label.text;
    case "superscript":
      return `${label.base}${label.exponent}`;
    case "sigma":
      return `σ${label.subscript}`;
    case "sum":
      return `Σx${label.exponent ?? ""}`;
  }
}
