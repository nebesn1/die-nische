import { describe, expect, it } from "vitest";
import {
  getKCalcCommandLabelText,
  kcalcBaseScientificCommandSlots,
  kcalcConstantsCommandSlots,
  kcalcLogicCommandSlots,
  kcalcMemoryAddCommandSlot,
  kcalcMemoryClearCommandSlot,
  kcalcMemoryRecallCommandSlot,
  kcalcMemoryStoreCommandSlot,
  kcalcPercentCommandSlot,
  kcalcScienceCommandSlots,
  kcalcScientificEntryCommandSlot,
  kcalcStatisticsCommandSlots,
  resolveKCalcCommandSurface,
  resolveKCalcScienceCommandSurface,
  type KCalcCommandSurfaceSlot,
} from "./kcalcCommandSurface";
import { initialKCalcModeState } from "./kcalcModeState";

const surface = (slots: readonly KCalcCommandSurfaceSlot[], slotId: string, inverse: boolean) => {
  const slot = slots.find((candidate) => candidate.slotId === slotId);

  if (!slot) {
    throw new Error(`Missing KCalc command slot ${slotId}`);
  }

  return resolveKCalcCommandSurface(slot, inverse);
};

const scienceSurface = (slotId: string, inverse: boolean, hyp: boolean) => {
  const slot = kcalcScienceCommandSlots.find((candidate) => candidate.slotId === slotId);

  if (!slot) {
    throw new Error(`Missing KCalc Science command slot ${slotId}`);
  }

  return resolveKCalcScienceCommandSurface(slot, { ...initialKCalcModeState, inverse, hyp });
};

describe("KCalc INV command surface", () => {
  it("resolves the non-hyperbolic science slots without treating labels as command authority", () => {
    expect(surface(kcalcScienceCommandSlots, "science-sin", false)).toMatchObject({ commandId: "sin", ariaLabel: "Sine", enabled: false });
    expect(surface(kcalcScienceCommandSlots, "science-sin", true)).toMatchObject({ commandId: "asin", ariaLabel: "Arc sine", enabled: false });
    expect(getKCalcCommandLabelText(surface(kcalcScienceCommandSlots, "science-sin", true).label)).toBe("Asin");
    expect(getKCalcCommandLabelText(surface(kcalcScienceCommandSlots, "science-cos", true).label)).toBe("Acos");
    expect(getKCalcCommandLabelText(surface(kcalcScienceCommandSlots, "science-tan", true).label)).toBe("Atan");
    expect(surface(kcalcScienceCommandSlots, "science-log", false)).toMatchObject({ commandId: "log10", enabled: false });
    expect(surface(kcalcScienceCommandSlots, "science-log", true)).toMatchObject({ commandId: "pow10", consumesInverse: true });
    expect(getKCalcCommandLabelText(surface(kcalcScienceCommandSlots, "science-log", true).label)).toBe("10x");
    expect(surface(kcalcScienceCommandSlots, "science-ln", true)).toMatchObject({ commandId: "exp", consumesInverse: true });
    expect(getKCalcCommandLabelText(surface(kcalcScienceCommandSlots, "science-ln", true).label)).toBe("ex");
    expect(surface(kcalcScienceCommandSlots, "science-hyp", true)).toBe(surface(kcalcScienceCommandSlots, "science-hyp", false));
  });

  it("resolves every physical trigonometric slot from independent Hyp and INV modes", () => {
    const matrix = [
      ["science-sin", "Sin", "sin", "Asin", "asin", "Sinh", "sinh", "Asinh", "asinh"],
      ["science-cos", "Cos", "cos", "Acos", "acos", "Cosh", "cosh", "Acosh", "acosh"],
      ["science-tan", "Tan", "tan", "Atan", "atan", "Tanh", "tanh", "Atanh", "atanh"],
    ] as const;

    for (const [slotId, normalLabel, normalId, inverseLabel, inverseId, hypLabel, hypId, inverseHypLabel, inverseHypId] of matrix) {
      expect(getKCalcCommandLabelText(scienceSurface(slotId, false, false).label)).toBe(normalLabel);
      expect(scienceSurface(slotId, false, false)).toMatchObject({ commandId: normalId, enabled: false, consumesInverse: false });
      expect(getKCalcCommandLabelText(scienceSurface(slotId, true, false).label)).toBe(inverseLabel);
      expect(scienceSurface(slotId, true, false)).toMatchObject({ commandId: inverseId, enabled: false, consumesInverse: true });
      expect(getKCalcCommandLabelText(scienceSurface(slotId, false, true).label)).toBe(hypLabel);
      expect(scienceSurface(slotId, false, true)).toMatchObject({ commandId: hypId, enabled: false, consumesInverse: false });
      expect(getKCalcCommandLabelText(scienceSurface(slotId, true, true).label)).toBe(inverseHypLabel);
      expect(scienceSurface(slotId, true, true)).toMatchObject({ commandId: inverseHypId, enabled: false, consumesInverse: true });
    }
  });

  it("keeps Log and Ln independent of Hyp while preserving their INV secondary identities", () => {
    for (const hyp of [false, true]) {
      expect(scienceSurface("science-log", false, hyp)).toMatchObject({ commandId: "log10", enabled: false });
      expect(getKCalcCommandLabelText(scienceSurface("science-log", false, hyp).label)).toBe("Log");
      expect(scienceSurface("science-log", true, hyp)).toMatchObject({ commandId: "pow10", enabled: false, consumesInverse: true });
      expect(getKCalcCommandLabelText(scienceSurface("science-log", true, hyp).label)).toBe("10x");
      expect(scienceSurface("science-ln", false, hyp)).toMatchObject({ commandId: "ln", enabled: false });
      expect(scienceSurface("science-ln", true, hyp)).toMatchObject({ commandId: "exp", enabled: false, consumesInverse: true });
    }
  });

  it("resolves base scientific and scientific-entry slots according to their stable physical identity", () => {
    expect(surface(kcalcBaseScientificCommandSlots, "base-mod", true)).toMatchObject({ commandId: "int-div", consumesInverse: true });
    expect(getKCalcCommandLabelText(surface(kcalcBaseScientificCommandSlots, "base-mod", true).label)).toBe("IntDiv");
    expect(surface(kcalcBaseScientificCommandSlots, "base-reciprocal", true)).toMatchObject({ commandId: "reciprocal" });
    expect(surface(kcalcBaseScientificCommandSlots, "base-factorial", true)).toMatchObject({ commandId: "factorial" });
    expect(getKCalcCommandLabelText(surface(kcalcBaseScientificCommandSlots, "base-square", true).label)).toBe("x³");
    expect(getKCalcCommandLabelText(surface(kcalcBaseScientificCommandSlots, "base-root", true).label)).toBe("∛x");
    expect(surface(kcalcBaseScientificCommandSlots, "base-power", true)).toMatchObject({ commandId: "inverse-power", consumesInverse: true });
    expect(getKCalcCommandLabelText(surface(kcalcBaseScientificCommandSlots, "base-power", true).label)).toBe("x1/y");
    expect(resolveKCalcCommandSurface(kcalcScientificEntryCommandSlot, true)).toBe(
      resolveKCalcCommandSurface(kcalcScientificEntryCommandSlot, false),
    );
  });

  it("maps the audited statistics, including INV lifecycle variants with invariant labels", () => {
    expect(getKCalcCommandLabelText(surface(kcalcStatisticsCommandSlots, "statistics-count", true).label)).toBe("Σx");
    expect(getKCalcCommandLabelText(surface(kcalcStatisticsCommandSlots, "statistics-mean", true).label)).toBe("Σx2");
    expect(getKCalcCommandLabelText(surface(kcalcStatisticsCommandSlots, "statistics-sample-standard-deviation", false).label)).toBe("σN−1");
    expect(getKCalcCommandLabelText(surface(kcalcStatisticsCommandSlots, "statistics-sample-standard-deviation", true).label)).toBe("σN");
    expect(getKCalcCommandLabelText(surface(kcalcStatisticsCommandSlots, "statistics-data", true).label)).toBe("CDat");
    expect(surface(kcalcStatisticsCommandSlots, "statistics-median", true)).toMatchObject({ commandId: "stat-median", consumesInverse: true });
    expect(surface(kcalcStatisticsCommandSlots, "statistics-clear", true)).toMatchObject({
      commandId: "stat-clear-inverse-noop",
      consumesInverse: true,
    });
  });

  it("keeps Logic labels and command identities stable while INV changes only lifecycle metadata", () => {
    const expected = [
      ["logic-and", "AND", "logic-and"],
      ["logic-or", "OR", "logic-or"],
      ["logic-xor", "XOR", "logic-xor"],
      ["logic-left-shift", "Lsh", "logic-left-shift"],
      ["logic-right-shift", "Rsh", "logic-right-shift"],
      ["logic-complement", "Cmp", "logic-complement"],
    ] as const;

    for (const [slotId, label, commandId] of expected) {
      expect(getKCalcCommandLabelText(surface(kcalcLogicCommandSlots, slotId, false).label)).toBe(label);
      expect(surface(kcalcLogicCommandSlots, slotId, false)).toMatchObject({ commandId, consumesInverse: false, enabled: false });
      expect(getKCalcCommandLabelText(surface(kcalcLogicCommandSlots, slotId, true).label)).toBe(label);
      expect(surface(kcalcLogicCommandSlots, slotId, true)).toMatchObject({ commandId, consumesInverse: true, enabled: false });
    }
  });

  it("keeps six physical constant slots while giving every inverse Store surface an individual command id", () => {
    expect(kcalcConstantsCommandSlots).toHaveLength(6);
    expect(kcalcConstantsCommandSlots.map((slot) => getKCalcCommandLabelText(resolveKCalcCommandSurface(slot, true).label))).toEqual([
      "Store", "Store", "Store", "Store", "Store", "Store",
    ]);
    expect(kcalcConstantsCommandSlots.map((slot) => resolveKCalcCommandSurface(slot, true).commandId)).toEqual([
      "store-constant-1",
      "store-constant-2",
      "store-constant-3",
      "store-constant-4",
      "store-constant-5",
      "store-constant-6",
    ]);
  });

  it("keeps stable memory physical slots while resolving M+ and M- to distinct command identities", () => {
    expect(resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, false)).toMatchObject({
      commandId: "memory-add",
      ariaLabel: "Add to memory",
      enabled: false,
    });
    expect(getKCalcCommandLabelText(resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, false).label)).toBe("M+");
    expect(resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, true)).toMatchObject({
      commandId: "memory-subtract",
      ariaLabel: "Subtract from memory",
      enabled: false,
      consumesInverse: true,
    });
    expect(getKCalcCommandLabelText(resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, true).label)).toBe("M-");
    expect(resolveKCalcCommandSurface(kcalcMemoryRecallCommandSlot, true)).toMatchObject({ commandId: "memory-recall" });
    expect(resolveKCalcCommandSurface(kcalcMemoryStoreCommandSlot, true)).toMatchObject({ commandId: "memory-store" });
    expect(resolveKCalcCommandSurface(kcalcMemoryClearCommandSlot, true)).toMatchObject({ commandId: "memory-clear" });
    expect(resolveKCalcCommandSurface(kcalcPercentCommandSlot, true)).toMatchObject({ commandId: "percent" });
  });

  it("declares one-shot INV consumption on secondary descriptors without applying it to invariant commands", () => {
    expect(surface(kcalcBaseScientificCommandSlots, "base-square", false).consumesInverse).toBe(false);
    expect(surface(kcalcBaseScientificCommandSlots, "base-square", true).consumesInverse).toBe(true);
    expect(surface(kcalcBaseScientificCommandSlots, "base-root", true).consumesInverse).toBe(true);
    expect(surface(kcalcBaseScientificCommandSlots, "base-reciprocal", true).consumesInverse).toBe(false);
    expect(resolveKCalcCommandSurface(kcalcMemoryRecallCommandSlot, true).consumesInverse).toBe(false);
    expect(resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, true).consumesInverse).toBe(true);
    expect(surface(kcalcScienceCommandSlots, "science-sin", true).consumesInverse).toBe(true);
    expect(resolveKCalcCommandSurface(kcalcConstantsCommandSlots[0], true).consumesInverse).toBe(true);
    expect(surface(kcalcStatisticsCommandSlots, "statistics-data", true)).toMatchObject({
      commandId: "stat-delete-data",
      consumesInverse: true,
    });
    expect(surface(kcalcStatisticsCommandSlots, "statistics-median", true)).toMatchObject({
      commandId: "stat-median",
      consumesInverse: true,
    });
    expect(surface(kcalcStatisticsCommandSlots, "statistics-clear", true)).toMatchObject({
      commandId: "stat-clear-inverse-noop",
      consumesInverse: true,
    });
    expect(surface(kcalcLogicCommandSlots, "logic-and", true)).toMatchObject({
      commandId: "logic-and",
      consumesInverse: true,
    });
  });

  it("derives the active descriptor enabled state from command availability without changing labels or identities", () => {
    const active = resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, true, (commandId) => commandId === "memory-subtract");
    const unavailable = resolveKCalcCommandSurface(kcalcMemoryAddCommandSlot, false, () => false);

    expect(active).toMatchObject({ commandId: "memory-subtract", enabled: true });
    expect(getKCalcCommandLabelText(active.label)).toBe("M-");
    expect(unavailable).toMatchObject({ commandId: "memory-add", enabled: false });
  });
});
