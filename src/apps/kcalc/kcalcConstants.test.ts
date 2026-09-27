import { describe, expect, it } from "vitest";
import {
  createDefaultKCalcConstantRegistry,
  getKCalcConstantSlot,
  getKCalcConstantSlotIdForCommand,
  parseKCalcConfiguredConstantValue,
  setKCalcConstant,
  setKCalcConstantName,
  setKCalcConstantValue,
} from "./kcalcConstants";

describe("KCalc constant registry", () => {
  it("creates six named zero-valued slots and preserves physical slot identity", () => {
    const constants = createDefaultKCalcConstantRegistry();

    expect(constants.map(({ id, name, value }) => [id, name, value])).toEqual([
      ["constant-1", "C1", { kind: "number", value: 0 }],
      ["constant-2", "C2", { kind: "number", value: 0 }],
      ["constant-3", "C3", { kind: "number", value: 0 }],
      ["constant-4", "C4", { kind: "number", value: 0 }],
      ["constant-5", "C5", { kind: "number", value: 0 }],
      ["constant-6", "C6", { kind: "number", value: 0 }],
    ]);
    expect(kcalcConstantCommands()).toEqual([
      ["constant-1", "store-constant-1", "constant-1"],
      ["constant-2", "store-constant-2", "constant-2"],
      ["constant-3", "store-constant-3", "constant-3"],
      ["constant-4", "store-constant-4", "constant-4"],
      ["constant-5", "store-constant-5", "constant-5"],
      ["constant-6", "store-constant-6", "constant-6"],
    ]);
  });

  it("updates only the selected slot without mutating the previous registry", () => {
    const defaults = createDefaultKCalcConstantRegistry();
    const updated = setKCalcConstantValue(defaults, "constant-3", { kind: "integer", value: 9007199254740993n });

    expect(getKCalcConstantSlot(defaults, "constant-3").value).toEqual({ kind: "number", value: 0 });
    expect(getKCalcConstantSlot(updated, "constant-3").value).toEqual({ kind: "integer", value: 9007199254740993n });
    expect(updated.filter((slot) => slot.id !== "constant-3").every((slot) => slot.value.kind === "number" && slot.value.value === 0)).toBe(true);
  });

  it("keeps presentation names separate from values and parses explicit decimal configuration values", () => {
    const defaults = createDefaultKCalcConstantRegistry();
    const renamed = setKCalcConstantName(defaults, "constant-1", "PI");
    const selected = setKCalcConstant(renamed, "constant-1", {
      name: "Pi",
      value: { kind: "number", value: Math.PI },
    });

    expect(getKCalcConstantSlot(renamed, "constant-1")).toEqual({ id: "constant-1", name: "PI", value: { kind: "number", value: 0 } });
    expect(getKCalcConstantSlot(selected, "constant-1")).toEqual({ id: "constant-1", name: "Pi", value: { kind: "number", value: Math.PI } });
    expect(parseKCalcConfiguredConstantValue("1.5")).toEqual({ kind: "number", value: 1.5 });
    expect(parseKCalcConfiguredConstantValue("9007199254740993")).toEqual({ kind: "integer", value: 9007199254740993n });
    expect(parseKCalcConfiguredConstantValue("FF")).toBeNull();
    expect(parseKCalcConfiguredConstantValue("Infinity")).toBeNull();
  });
});

const kcalcConstantCommands = () => createDefaultKCalcConstantRegistry().map(({ id }) =>
  [id, `store-${id}`, getKCalcConstantSlotIdForCommand(`store-${id}`)],
);
