import { describe, expect, it } from "vitest";
import {
  getCalculatorActionForCommand,
  getKCalcConstantValueFromCalculatorState,
  initialCalculatorState,
  isCalculatorCommandEnabled,
  reduceCalculator,
  type CalculatorAction,
  type CalculatorState,
} from "./calculatorCore";
import type { KCalcConstantValue } from "./kcalcConstants";

const command = (commandId: string, numberBase: "decimal" | "hex" | "octal" | "binary" = "decimal", constantValue?: KCalcConstantValue): CalculatorAction => {
  const action = getCalculatorActionForCommand(commandId, { angleUnit: "degrees", numberBase, constantValue });

  if (action === null) {
    throw new Error(`Expected constant command: ${commandId}`);
  }

  return action;
};

const reduce = (actions: readonly CalculatorAction[]): CalculatorState => actions.reduce(reduceCalculator, initialCalculatorState);
const digits = (value: string, numberBase: "decimal" | "hex" | "octal" | "binary" = "decimal"): readonly CalculatorAction[] =>
  [...value].map((digit) => ({ type: "digit", digit, numberBase }));

describe("KCalc constant command core transitions", () => {
  it("stores the current canonical value without finalizing arithmetic or Logic pending operations", () => {
    const arithmetic = reduce([...digits("2"), { type: "operator", operator: "+" }, ...digits("5"), command("store-constant-1")]);
    const logic = reduce([
      { type: "set-base", numberBase: "hex" },
      ...digits("F", "hex"), command("logic-and", "hex"), ...digits("A", "hex"), command("store-constant-1", "hex"),
    ]);

    expect(getKCalcConstantValueFromCalculatorState(arithmetic)).toEqual({ kind: "number", value: 5 });
    expect(reduceCalculator(arithmetic, { type: "equals" }).display).toBe("7");
    expect(reduceCalculator(arithmetic, { type: "digit", digit: "2" }).display).toBe("2");
    expect(getKCalcConstantValueFromCalculatorState(logic)).toEqual({ kind: "integer", value: 10n });
    expect(reduceCalculator(logic, { type: "equals", numberBase: "hex" }).display).toBe("A");
  });

  it("recalls values through the unified base formatter with fresh-entry and pending contracts", () => {
    const recalled = reduce([command("constant-1", "hex", { kind: "integer", value: 255n })]);
    const octal = reduce([command("constant-1", "octal", { kind: "integer", value: 255n })]);
    const binary = reduce([command("constant-1", "binary", { kind: "integer", value: 255n })]);
    const pending = reduce([
      ...digits("2"), { type: "operator", operator: "+" }, command("constant-1", "decimal", { kind: "number", value: 5 }), { type: "equals" },
    ]);
    const fresh = reduceCalculator(recalled, { type: "digit", digit: "A", numberBase: "hex" });

    expect(recalled).toMatchObject({ display: "FF", radixEntry: { base: 16, digits: "FF" }, waitingForOperand: true });
    expect(octal.display).toBe("377");
    expect(binary.display).toBe("11111111");
    expect(pending.display).toBe("7");
    expect(fresh.display).toBe("A");
  });

  it("preserves exact oversized integers and lets recall recover from Error while Store is unavailable", () => {
    const oversized = reduce([command("constant-1", "hex", { kind: "integer", value: 9007199254740993n })]);
    const beyond64Bit = reduce([command("constant-1", "hex", { kind: "integer", value: 1180591620717411303424n })]);
    const logic = reduce([
      { type: "set-base", numberBase: "hex" },
      ...digits("F", "hex"), command("logic-and", "hex"), command("constant-1", "hex", { kind: "integer", value: 10n }), { type: "equals", numberBase: "hex" },
    ]);
    const error = reduce([...digits("1"), { type: "operator", operator: "/" }, ...digits("0"), { type: "equals" }]);
    const recovered = reduceCalculator(error, command("constant-1", "decimal", { kind: "number", value: 1.5 }));

    expect(oversized).toMatchObject({ display: "20000000000001", radixEntry: { base: 16, digits: "20000000000001" } });
    expect(beyond64Bit.display).toBe("400000000000000000");
    expect(logic.display).toBe("A");
    expect(isCalculatorCommandEnabled(oversized, "logic-or")).toBe(true);
    expect(isCalculatorCommandEnabled(oversized, "memory-store")).toBe(false);
    expect(isCalculatorCommandEnabled(oversized, "memory-store")).toBe(false);
    expect(isCalculatorCommandEnabled(error, "store-constant-1")).toBe(false);
    expect(isCalculatorCommandEnabled(error, "constant-1")).toBe(true);
    expect(recovered).toMatchObject({ display: "1.5", error: false, waitingForOperand: true });
  });

  it("inserts a built-in number through the calculator command boundary without changing registers", () => {
    const builtIn = getCalculatorActionForCommand("built-in-constant-recall", {
      angleUnit: "degrees",
      numberBase: "decimal",
      builtInConstantValue: Math.PI,
    });
    const pending = reduce([
      ...digits("2"),
      { type: "operator", operator: "+" },
      builtIn!,
      { type: "equals" },
    ]);
    const error = reduce([...digits("1"), { type: "operator", operator: "/" }, ...digits("0"), { type: "equals" }]);
    const recovered = reduceCalculator(error, builtIn!);

    expect(pending.display).toBe("5.14159265359");
    expect(recovered).toMatchObject({ display: "3.14159265359", error: false, waitingForOperand: true });
  });
});
