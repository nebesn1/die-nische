import { describe, expect, it } from "vitest";
import {
  MAX_CALCULATOR_DIGITS,
  canCurrentCalculatorValueEnterNumberDomain,
  classifyCalculatorOperandDomain,
  getCalculatorActionForCommand,
  getKCalcClipboardText,
  formatCalculatorNumber,
  getCalculatorActionForKey,
  initialCalculatorState,
  isCalculatorActionEnabled,
  isCalculatorCommandEnabled,
  reduceCalculator,
  type CalculatorAction,
  type CalculatorState,
} from "./calculatorCore";

const reduce = (actions: readonly CalculatorAction[]): CalculatorState =>
  actions.reduce(reduceCalculator, initialCalculatorState);

const reduceFrom = (state: CalculatorState, actions: readonly CalculatorAction[]): CalculatorState =>
  actions.reduce(reduceCalculator, state);

const digits = (value: string): readonly CalculatorAction[] =>
  [...value].map((digit) => ({ type: "digit", digit }));

const enteredNumber = (value: string): readonly CalculatorAction[] =>
  [...value].map((character) => character === "." ? { type: "decimal" } : { type: "digit", digit: character });

const command = (commandId: string): CalculatorAction => {
  const action = getCalculatorActionForCommand(commandId);

  if (action === null) {
    throw new Error(`Expected executable KCalc command: ${commandId}`);
  }

  return action;
};

const scienceCommand = (commandId: string, angleUnit: "degrees" | "radians" | "gradians" = "degrees"): CalculatorAction => {
  const action = getCalculatorActionForCommand(commandId, { angleUnit });

  if (action === null) {
    throw new Error(`Expected executable KCalc Science command: ${commandId}`);
  }

  return action;
};

const commandInBase = (commandId: string, numberBase: "hex" | "decimal" | "octal" | "binary"): CalculatorAction => {
  const action = getCalculatorActionForCommand(commandId, { angleUnit: "degrees", numberBase });

  if (action === null) {
    throw new Error(`Expected executable base-aware KCalc command: ${commandId}`);
  }

  return action;
};

const radixDigits = (value: string, numberBase: "hex" | "decimal" | "octal" | "binary"): readonly CalculatorAction[] =>
  [...value].map((digit) => ({ type: "digit", digit, numberBase }));

const withStatistics = (values: readonly string[]): CalculatorState => values.reduce(
  (state, value) => reduceFrom(state, [...enteredNumber(value), command("stat-enter-data")]),
  initialCalculatorState,
);

describe("formatCalculatorNumber", () => {
  it("formats finite values deterministically without locale grouping or negative zero", () => {
    expect(formatCalculatorNumber(0)).toBe("0");
    expect(formatCalculatorNumber(-0)).toBe("0");
    expect(formatCalculatorNumber(42)).toBe("42");
    expect(formatCalculatorNumber(-12.5)).toBe("-12.5");
    expect(formatCalculatorNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatCalculatorNumber(1e20)).toBe("100000000000000000000");
    expect(formatCalculatorNumber(1e-20)).toBe("1e-20");
    expect(formatCalculatorNumber(Number.NaN)).toBe("Error");
    expect(formatCalculatorNumber(Number.POSITIVE_INFINITY)).toBe("Error");
  });
});

describe("calculator reducer", () => {
  it("enters digits, prevents leading zero growth, and allows one decimal point", () => {
    expect(reduce([...digits("001"), { type: "decimal" }, ...digits("23"), { type: "decimal" }]).display).toBe("1.23");
    expect(reduce([{ type: "decimal" }, ...digits("01")]).display).toBe("0.01");
  });

  it("limits manually entered digits without constraining decimal punctuation", () => {
    const state = reduce([...digits("9".repeat(MAX_CALCULATOR_DIGITS + 2)), { type: "decimal" }]);

    expect(state.display).toBe(`${"9".repeat(MAX_CALCULATOR_DIGITS)}.`);
  });

  it("executes all four binary operations immediately", () => {
    expect(reduce([{ type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" }, { type: "equals" }]).display).toBe("5");
    expect(reduce([{ type: "digit", digit: "9" }, { type: "operator", operator: "-" }, { type: "digit", digit: "4" }, { type: "equals" }]).display).toBe("5");
    expect(reduce([{ type: "digit", digit: "6" }, { type: "operator", operator: "*" }, { type: "digit", digit: "7" }, { type: "equals" }]).display).toBe("42");
    expect(reduce([{ type: "digit", digit: "8" }, { type: "operator", operator: "/" }, { type: "digit", digit: "2" }, { type: "equals" }]).display).toBe("4");
  });

  it("uses pocket-calculator immediate execution and replaces a pending operator", () => {
    expect(reduce([
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" },
      { type: "operator", operator: "+" }, { type: "digit", digit: "4" }, { type: "equals" },
    ]).display).toBe("9");
    expect(reduce([
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "operator", operator: "*" },
      { type: "digit", digit: "3" }, { type: "equals" },
    ]).display).toBe("6");
  });

  it("treats equals without a complete pending operation as a no-op", () => {
    const first = reduce([{ type: "digit", digit: "5" }, { type: "equals" }]);
    const second = reduce([{ type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" }, { type: "equals" }, { type: "equals" }]);

    expect(first.display).toBe("5");
    expect(second.display).toBe("5");
  });

  it("contains division by zero as Error and starts fresh on the next digit", () => {
    const error = reduce([{ type: "digit", digit: "1" }, { type: "operator", operator: "/" }, { type: "digit", digit: "0" }, { type: "equals" }]);
    const reset = reduceCalculator(error, { type: "digit", digit: "5" });

    expect(error).toMatchObject({ display: "Error", error: true });
    expect(reduceCalculator(error, { type: "operator", operator: "+" })).toBe(error);
    expect(reduceCalculator(error, { type: "decimal" })).toBe(error);
    expect(reduceCalculator(error, { type: "backspace" })).toBe(error);
    expect(reset).toEqual({ ...initialCalculatorState, display: "5" });
  });

  it("edits entries while preserving a pending calculation for CE", () => {
    expect(reduce([...digits("123"), { type: "backspace" }]).display).toBe("12");
    expect(reduce([{ type: "digit", digit: "1" }, { type: "backspace" }]).display).toBe("0");
    expect(reduce([
      ...digits("12"), { type: "operator", operator: "+" }, ...digits("34"), { type: "clear-entry" },
      { type: "digit", digit: "5" }, { type: "equals" },
    ]).display).toBe("17");
    expect(reduce([...digits("12"), { type: "toggle-sign" }, { type: "toggle-sign" }]).display).toBe("12");
    expect(reduce([{ type: "toggle-sign" }]).display).toBe("0");
  });

  it("fully resets on clear", () => {
    const state = reduce([{ type: "digit", digit: "9" }, { type: "operator", operator: "+" }, { type: "clear" }]);

    expect(state).toBe(initialCalculatorState);
  });
});

describe("KCalc base entry and representation", () => {
  it("converts the current value between decimal, hexadecimal, octal, and binary without changing its numeric meaning", () => {
    const hexadecimal = reduce([...digits("255"), { type: "set-base", numberBase: "hex" }]);
    const octal = reduceCalculator(hexadecimal, { type: "set-base", numberBase: "octal" });
    const binary = reduceCalculator(octal, { type: "set-base", numberBase: "binary" });
    const decimal = reduceCalculator(binary, { type: "set-base", numberBase: "decimal" });

    expect(hexadecimal).toMatchObject({ display: "FF", radixEntry: { base: 16, negative: false, digits: "FF" } });
    expect(octal.display).toBe("377");
    expect(binary.display).toBe("11111111");
    expect(decimal).toMatchObject({ display: "255", radixEntry: null });
  });

  it("supports uppercase hexadecimal entry, signed magnitude, and the base digit matrix through reducer authority", () => {
    const hexadecimal = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("AF", "hex"),
    ]);
    const negative = reduceCalculator(hexadecimal, { type: "toggle-sign" });
    const decimal = reduceCalculator(negative, { type: "set-base", numberBase: "decimal" });

    expect(hexadecimal).toMatchObject({ display: "AF", radixEntry: { base: 16, negative: false, digits: "AF" } });
    expect(negative.display).toBe("-AF");
    expect(decimal).toMatchObject({ display: "-175", radixEntry: null });
    expect(reduce([{ type: "set-base", numberBase: "binary" }, { type: "digit", digit: "2", numberBase: "binary" }])).toMatchObject({ display: "0", radixEntry: { base: 2, negative: false, digits: "0" } });
    expect(reduce([{ type: "set-base", numberBase: "octal" }, { type: "digit", digit: "8", numberBase: "octal" }])).toMatchObject({ display: "0", radixEntry: { base: 8, negative: false, digits: "0" } });
  });

  it("truncates decimal fractions toward zero when entering a nondecimal presentation and establishes a fresh entry", () => {
    const hexadecimal = reduce([...enteredNumber("12.75"), { type: "set-base", numberBase: "hex" }]);
    const negative = reduce([...enteredNumber("12.75"), { type: "toggle-sign" }, { type: "set-base", numberBase: "hex" }]);
    const fresh = reduceCalculator(hexadecimal, { type: "digit", digit: "A", numberBase: "hex" });

    expect(hexadecimal.display).toBe("C");
    expect(negative.display).toBe("-C");
    expect(reduceCalculator(hexadecimal, { type: "set-base", numberBase: "decimal" })).toMatchObject({ display: "12", radixEntry: null });
    expect(fresh).toMatchObject({ display: "A", radixEntry: { base: 16, negative: false, digits: "A" }, waitingForOperand: false });
  });

  it("preserves the immediate pending operation while reformatting its current operand", () => {
    const switched = reduce([
      ...digits("10"),
      { type: "operator", operator: "+", numberBase: "decimal" },
      ...digits("15"),
      { type: "set-base", numberBase: "hex" },
    ]);
    const result = reduceCalculator(switched, { type: "equals", numberBase: "hex" });

    expect(switched).toMatchObject({ display: "F", accumulator: 10, pendingOperator: "+", waitingForOperand: true, hasCurrentOperand: true });
    expect(result).toMatchObject({ display: "19", accumulator: null, pendingOperator: null });
  });

  it("formats memory and statistics results in the current base while keeping their numeric authorities unchanged", () => {
    const stored = reduce([...digits("255"), command("memory-store"), { type: "set-base", numberBase: "hex" }]);
    const recalled = reduceCalculator(stored, commandInBase("memory-recall", "hex"));
    const statistics = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("A", "hex"),
      commandInBase("stat-enter-data", "hex"),
      commandInBase("stat-sum", "hex"),
    ]);

    expect(recalled).toMatchObject({ display: "FF", memoryValue: 255 });
    expect(statistics).toMatchObject({ display: "A", statisticsValues: [10] });
  });

  it("keeps exact large radix entries convertible while rejecting unsupported number-only operations", () => {
    const large = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("20000000000001", "hex"),
    ]);
    const binary = reduceCalculator(large, { type: "set-base", numberBase: "binary" });
    const unsupported = reduceCalculator(binary, commandInBase("memory-store", "binary"));

    expect(binary.display).toBe("100000000000000000000000000000000000000000000000000001");
    expect(unsupported).toMatchObject({ display: "Error", error: true, memoryValue: null });
  });
});

describe("calculator keyboard mapping", () => {
  it("maps the supported local calculator keys and rejects unsupported keys", () => {
    expect(getCalculatorActionForKey("7")).toEqual({ type: "digit", digit: "7" });
    expect(getCalculatorActionForKey(".")).toEqual({ type: "decimal" });
    expect(getCalculatorActionForKey("+")).toEqual({ type: "operator", operator: "+" });
    expect(getCalculatorActionForKey("Enter")).toEqual({ type: "equals" });
    expect(getCalculatorActionForKey("Escape")).toEqual({ type: "clear" });
    expect(getCalculatorActionForKey("Backspace")).toEqual({ type: "backspace" });
    expect(getCalculatorActionForKey("Delete")).toEqual({ type: "clear-entry" });
    expect(getCalculatorActionForKey("x")).toBeNull();
  });
});

describe("KCalc base scientific commands", () => {
  it("executes the confirmed unary commands and contains their invalid domains as Error", () => {
    expect(reduce([...digits("4"), command("reciprocal")]).display).toBe("0.25");
    expect(reduce([...digits("0"), command("reciprocal")]).display).toBe("Error");
    expect(reduce([...digits("5"), command("square")]).display).toBe("25");
    expect(reduce([...digits("3"), command("cube")]).display).toBe("27");
    expect(reduce([...digits("9"), command("sqrt")]).display).toBe("3");
    expect(reduce([{ type: "digit", digit: "8" }, { type: "toggle-sign" }, command("sqrt")]).display).toBe("Error");
    expect(reduce([...digits("8"), command("cuberoot")]).display).toBe("2");
    expect(reduce([{ type: "digit", digit: "8" }, { type: "toggle-sign" }, command("cuberoot")]).display).toBe("-2");
  });

  it("uses an iterative factorial with a finite non-negative integer domain", () => {
    expect(reduce([...digits("0"), command("factorial")]).display).toBe("1");
    expect(reduce([...digits("1"), command("factorial")]).display).toBe("1");
    expect(reduce([...digits("5"), command("factorial")]).display).toBe("120");
    expect(reduce([{ type: "digit", digit: "1" }, { type: "decimal" }, { type: "digit", digit: "5" }, command("factorial")]).display).toBe("Error");
    expect(reduce([{ type: "digit", digit: "1" }, { type: "toggle-sign" }, command("factorial")]).display).toBe("Error");
    expect(reduce([...digits("171"), command("factorial")]).display).toBe("Error");
  });

  it("routes power commands through immediate binary operation state without changing basic precedence", () => {
    expect(reduce([{ type: "digit", digit: "2" }, command("power"), { type: "digit", digit: "3" }, { type: "equals" }]).display).toBe("8");
    expect(reduce([{ type: "digit", digit: "8" }, command("inverse-power"), { type: "digit", digit: "3" }, { type: "equals" }]).display).toBe("2");
    expect(reduce([{ type: "digit", digit: "8" }, { type: "toggle-sign" }, command("inverse-power"), { type: "digit", digit: "3" }, { type: "equals" }]).display).toBe("-2");
    expect(reduce([{ type: "digit", digit: "8" }, command("inverse-power"), { type: "digit", digit: "0" }, { type: "equals" }]).display).toBe("Error");
    expect(reduce([
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" },
      { type: "operator", operator: "*" }, { type: "digit", digit: "4" }, { type: "equals" },
    ]).display).toBe("20");
  });

  it("implements KCalc Mod as Euclidean remainder and IntDiv as a truncated integer quotient", () => {
    expect(reduce([...digits("22"), command("mod"), { type: "digit", digit: "8" }, { type: "equals" }]).display).toBe("6");
    expect(reduce([...enteredNumber("22.345"), command("mod"), { type: "digit", digit: "8" }, { type: "equals" }]).display).toBe("6.345");
    expect(reduce([{ type: "digit", digit: "2" }, { type: "toggle-sign" }, { type: "digit", digit: "2" }, command("mod"), { type: "digit", digit: "8" }, { type: "equals" }]).display).toBe("2");
    expect(reduce([...enteredNumber("22.345"), command("int-div"), { type: "digit", digit: "8" }, { type: "equals" }]).display).toBe("2");
    expect(reduce([{ type: "digit", digit: "2" }, { type: "toggle-sign" }, { type: "digit", digit: "2" }, command("int-div"), { type: "digit", digit: "8" }, { type: "equals" }]).display).toBe("-2");
    expect(reduce([{ type: "digit", digit: "2" }, command("mod"), { type: "digit", digit: "0" }, { type: "equals" }]).display).toBe("Error");
    expect(reduce([{ type: "digit", digit: "2" }, command("int-div"), { type: "digit", digit: "0" }, { type: "equals" }]).display).toBe("Error");
  });

  it("applies the documented contextual percent rules through the current pending operation", () => {
    expect(reduce([...digits("150"), { type: "operator", operator: "+" }, ...digits("50"), command("percent")]).display).toBe("225");
    expect(reduce([...digits("42"), { type: "operator", operator: "*" }, { type: "digit", digit: "3" }, command("percent")]).display).toBe("1.26");
    expect(reduce([...digits("45"), { type: "operator", operator: "/" }, ...digits("55"), command("percent")]).display).toBe("81.8181818182");
  });
});

describe("KCalc Science commands", () => {
  it("routes command ids through the reducer with the command-time Angle context", () => {
    expect(isCalculatorCommandEnabled(initialCalculatorState, "sin")).toBe(true);
    expect(reduce([...digits("30"), scienceCommand("sin")])).toMatchObject({ display: "0.5", waitingForOperand: true });
    expect(reduce([...enteredNumber("1.57079632679"), scienceCommand("sin", "radians")]).display).toBe("1");
    expect(reduce([...enteredNumber("0.5"), scienceCommand("asin")]).display).toBe("30");
    expect(reduce([...digits("1"), scienceCommand("atan", "gradians")]).display).toBe("50");
  });

  it("shares existing unary pending-operation, next-entry, formatting, and Error transitions", () => {
    expect(reduce([
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, ...digits("30"), scienceCommand("sin"), { type: "equals" },
    ])).toMatchObject({ display: "2.5", pendingOperator: null, waitingForOperand: true });
    expect(reduce([...digits("30"), scienceCommand("sin"), { type: "digit", digit: "2" }])).toMatchObject({ display: "2", waitingForOperand: false });
    expect(reduce([...digits("2"), scienceCommand("asin")])).toMatchObject({ display: "Error", error: true });
    expect(reduce([...digits("2"), scienceCommand("asin"), { type: "digit", digit: "5" }])).toMatchObject({ display: "5", error: false });
    expect(reduce([...digits("90"), scienceCommand("tan")])).toMatchObject({ display: "Error", error: true });
  });

  it("executes finite hyperbolic, logarithmic, and exponential command ids without changing immediate execution", () => {
    expect(Number(reduce([...digits("1"), scienceCommand("sinh")]).display)).toBeCloseTo(Math.sinh(1));
    expect(reduce([...digits("1"), scienceCommand("acosh")]).display).toBe("0");
    expect(reduce([...digits("0"), scienceCommand("atanh")]).display).toBe("0");
    expect(reduce([...digits("100"), scienceCommand("log10")]).display).toBe("2");
    expect(reduce([...digits("2"), scienceCommand("pow10")]).display).toBe("100");
    expect(reduce([...digits("1"), scienceCommand("exp")]).display).toBe("2.71828182846");
    expect(reduce([
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" },
      { type: "operator", operator: "*" }, { type: "digit", digit: "4" }, { type: "equals" },
    ]).display).toBe("20");
  });
});

describe("KCalc memory commands", () => {
  it("keeps an empty register disabled for recall and clear, then stores, recalls, adds, subtracts, and clears per reducer", () => {
    expect(initialCalculatorState.memoryValue).toBeNull();
    expect(isCalculatorCommandEnabled(initialCalculatorState, "memory-recall")).toBe(false);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "memory-clear")).toBe(true);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "memory-store")).toBe(true);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "memory-add")).toBe(true);

    const stored = reduce([...digits("5"), command("memory-store")]);
    expect(stored).toMatchObject({ display: "5", memoryValue: 5 });
    expect(isCalculatorCommandEnabled(stored, "memory-recall")).toBe(true);
    expect(reduceCalculator(stored, command("memory-recall"))).toMatchObject({ display: "5", memoryValue: 5, waitingForOperand: false });
    expect(reduceCalculator(stored, command("memory-add")).memoryValue).toBe(10);
    expect(reduceCalculator(stored, command("memory-subtract")).memoryValue).toBe(0);
    expect(reduceCalculator(stored, command("memory-clear")).memoryValue).toBeNull();
  });

  it("recalls into the pending immediate operation and keeps memory through C, AC, and Error recovery", () => {
    const stored = reduce([...digits("5"), command("memory-store")]);
    const recalled = [
      { type: "clear" } as const,
      { type: "digit", digit: "2" } as const,
      { type: "operator", operator: "+" } as const,
      command("memory-recall"),
      { type: "equals" } as const,
    ].reduce(reduceCalculator, stored);
    expect(recalled).toMatchObject({ display: "7", memoryValue: 5 });
    expect(reduceCalculator(recalled, { type: "clear-entry" })).toMatchObject({ memoryValue: 5 });
    expect(reduceCalculator(recalled, { type: "clear" })).toMatchObject({ display: "0", memoryValue: 5 });

    const error = reduce([...digits("5"), command("memory-store"), { type: "operator", operator: "/" }, { type: "digit", digit: "0" }, { type: "equals" }]);
    expect(error).toMatchObject({ display: "Error", error: true, memoryValue: 5 });
    expect(reduceCalculator(error, { type: "digit", digit: "9" })).toMatchObject({ display: "9", error: false, memoryValue: 5 });
  });

  it("commits the current entry before MS, preserving memory while the next digit begins a fresh entry", () => {
    const stored = reduce([...digits("20"), command("memory-store")]);

    expect(stored).toMatchObject({ display: "20", memoryValue: 20, waitingForOperand: true });
    const freshEntry = reduceCalculator(stored, { type: "digit", digit: "5" });
    expect(freshEntry).toMatchObject({ display: "5", memoryValue: 20, waitingForOperand: false });
    const continuedEntry = reduceCalculator(freshEntry, { type: "digit", digit: "6" });
    expect(continuedEntry).toMatchObject({ display: "56", memoryValue: 20 });
    expect(reduceCalculator(continuedEntry, command("memory-recall"))).toMatchObject({ display: "20", memoryValue: 20 });
  });

  it("finalizes a complete pending operation before MS, M+, and M- commit a fresh next entry", () => {
    const pendingStored = reduce([
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" }, command("memory-store"),
    ]);
    expect(pendingStored).toMatchObject({ display: "5", memoryValue: 5, accumulator: null, pendingOperator: null, waitingForOperand: true });
    expect(reduceCalculator(pendingStored, { type: "digit", digit: "7" })).toMatchObject({ display: "7", memoryValue: 5 });

    const added = reduce([
      ...digits("20"), command("memory-store"), { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" }, command("memory-add"),
    ]);
    expect(added).toMatchObject({ display: "5", memoryValue: 25, waitingForOperand: true });
    expect(reduceCalculator(added, { type: "digit", digit: "7" })).toMatchObject({ display: "7", memoryValue: 25 });

    const subtracted = reduce([
      ...digits("20"), command("memory-store"), { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" }, command("memory-subtract"),
    ]);
    expect(subtracted).toMatchObject({ display: "5", memoryValue: 15, waitingForOperand: true });
    expect(reduceCalculator(subtracted, { type: "digit", digit: "7" })).toMatchObject({ display: "7", memoryValue: 15 });
  });

  it("keeps memory state independent across calculator instances", () => {
    const first = reduce([...digits("10"), command("memory-store")]);
    const second = reduce([...digits("20"), command("memory-store")]);

    expect(first.memoryValue).toBe(10);
    expect(second.memoryValue).toBe(20);
    expect(reduceCalculator(first, command("memory-add"))).toMatchObject({ memoryValue: 20 });
    expect(second.memoryValue).toBe(20);
  });
});

describe("KCalc clipboard reducer commands", () => {
  const clipboardAction = (commandId: "edit-copy" | "edit-cut" | "edit-paste", clipboardText?: string): CalculatorAction => {
    const action = getCalculatorActionForCommand(commandId, {
      angleUnit: "degrees",
      numberBase: "decimal",
      clipboardText,
    });

    if (action === null) {
      throw new Error(`Expected KCalc clipboard action: ${commandId}`);
    }

    return action;
  };

  it("formats Copy canonically without changing calculator state", () => {
    const decimal = reduceCalculator(initialCalculatorState, clipboardAction("edit-paste", "6.6742e-11"));
    const hexadecimal = reduceFrom(initialCalculatorState, [
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("FF", "hex"),
    ]);
    const negativeHexadecimal = reduceFrom(hexadecimal, [{ type: "toggle-sign" }]);

    expect(getKCalcClipboardText(decimal, "decimal")).toBe("6.6742e-11");
    expect(getKCalcClipboardText(hexadecimal, "hex")).toBe("0xFF");
    expect(getKCalcClipboardText(negativeHexadecimal, "hex")).toBe("-0xFF");
    expect(reduceCalculator(decimal, clipboardAction("edit-copy"))).toBe(decimal);
  });

  it("cuts only the current entry after Copy semantics and keeps pending arithmetic", () => {
    const pending = reduce([
      { type: "digit", digit: "2" },
      { type: "operator", operator: "+" },
      { type: "digit", digit: "3" },
    ]);
    const cut = reduceCalculator(pending, clipboardAction("edit-cut"));

    expect(cut).toMatchObject({ display: "0", accumulator: 2, pendingOperator: "+", waitingForOperand: true, error: false });
    expect(reduceCalculator(cut, { type: "equals" })).toMatchObject({ display: "2" });
    const errored = reduce([{ type: "digit", digit: "1" }, { type: "operator", operator: "/" }, { type: "digit", digit: "0" }, { type: "equals" }]);
    expect(reduceCalculator(errored, clipboardAction("edit-cut"))).toBe(errored);
  });

  it("pastes exact radix and decimal text as a fresh current operand while preserving pending work", () => {
    const pending = reduce([
      { type: "digit", digit: "2" },
      { type: "operator", operator: "+" },
    ]);
    const decimal = reduceCalculator(pending, clipboardAction("edit-paste", " 3 "));
    const hexadecimal = reduceCalculator(initialCalculatorState, {
      type: "clipboard-paste",
      text: "-0xA",
      numberBase: "hex",
    });
    const exact = reduceCalculator(initialCalculatorState, {
      type: "clipboard-paste",
      text: "20000000000001",
      numberBase: "hex",
    });

    expect(decimal).toMatchObject({ display: "3", accumulator: 2, pendingOperator: "+", waitingForOperand: true, error: false });
    expect(reduceCalculator(decimal, { type: "equals" }).display).toBe("5");
    expect(hexadecimal).toMatchObject({ display: "-A", error: false, waitingForOperand: true });
    expect(getKCalcClipboardText(exact, "hex")).toBe("0x20000000000001");
  });

  it("uses the existing Error authority for invalid Paste and allows valid Paste recovery", () => {
    const invalid = reduceCalculator(initialCalculatorState, clipboardAction("edit-paste", "0b1010"));
    const recovered = reduceCalculator(invalid, clipboardAction("edit-paste", "42"));
    const whitespace = reduceCalculator(initialCalculatorState, clipboardAction("edit-paste", "  \t "));

    expect(invalid).toMatchObject({ display: "Error", error: true });
    expect(whitespace).toMatchObject({ display: "Error", error: true });
    expect(recovered).toMatchObject({ display: "42", error: false, waitingForOperand: true });
  });
});

describe("KCalc statistics data commands", () => {
  it("owns an immutable empty dataset and exposes E1 data commands plus E2 queries", () => {
    expect(initialCalculatorState.statisticsValues).toEqual([]);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "stat-enter-data")).toBe(true);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "stat-delete-data")).toBe(false);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "stat-clear")).toBe(true);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "stat-clear-inverse-noop")).toBe(true);
    expect(getCalculatorActionForCommand("stat-count")).toMatchObject({ type: "command", commandId: "stat-count" });
    expect(getCalculatorActionForCommand("stat-mean")).toMatchObject({ type: "command", commandId: "stat-mean" });
    expect(getCalculatorActionForCommand("stat-median")).toMatchObject({ type: "command", commandId: "stat-median" });
    expect(isCalculatorCommandEnabled(initialCalculatorState, "stat-mean")).toBe(true);
  });

  it("stores the direct display value, shows the count, and starts a fresh next entry", () => {
    const first = reduce([...digits("20"), command("stat-enter-data")]);
    expect(first).toMatchObject({ display: "1", waitingForOperand: true, statisticsValues: [20] });

    const freshEntry = reduceCalculator(first, { type: "digit", digit: "5" });
    const continuedEntry = reduceCalculator(freshEntry, { type: "digit", digit: "6" });
    expect(freshEntry).toMatchObject({ display: "5", waitingForOperand: false, statisticsValues: [20] });
    expect(continuedEntry).toMatchObject({ display: "56", statisticsValues: [20] });

    const second = reduceCalculator(freshEntry, command("stat-enter-data"));
    expect(second).toMatchObject({ display: "2", waitingForOperand: true, statisticsValues: [20, 5] });
  });

  it("uses the current count display for repeated Dat rather than retaining an earlier source value", () => {
    const first = reduce([...digits("20"), command("stat-enter-data")]);
    const second = reduceCalculator(first, command("stat-enter-data"));

    expect(second).toMatchObject({ display: "2", statisticsValues: [20, 1] });
  });

  it("does not finalize a pending arithmetic operation before Dat", () => {
    const dataEntered = reduce([
      { type: "digit", digit: "2" },
      { type: "operator", operator: "+" },
      { type: "digit", digit: "3" },
      command("stat-enter-data"),
    ]);

    expect(dataEntered).toMatchObject({
      display: "1",
      accumulator: 2,
      pendingOperator: "+",
      waitingForOperand: true,
      statisticsValues: [3],
    });
    expect(reduceCalculator(dataEntered, { type: "equals" })).toMatchObject({ display: "3", statisticsValues: [3] });
  });

  it("deletes only the last value, displays zero, and has a defensive empty no-op", () => {
    const values = reduce([
      ...digits("10"), command("stat-enter-data"),
      ...digits("20"), command("stat-enter-data"),
      ...digits("30"), command("stat-enter-data"),
    ]);
    const deleted = reduceCalculator(values, command("stat-delete-data"));

    expect(deleted).toMatchObject({ display: "0", waitingForOperand: true, statisticsValues: [10, 20] });
    const freshEntry = reduceCalculator(deleted, { type: "digit", digit: "5" });
    expect(reduceCalculator(freshEntry, command("stat-enter-data"))).toMatchObject({ display: "3", statisticsValues: [10, 20, 5] });
    expect(reduceCalculator(initialCalculatorState, command("stat-delete-data"))).toBe(initialCalculatorState);
  });

  it("clears statistics without changing display, pending arithmetic, memory, or dataset lifecycle through C, AC, and Error", () => {
    const withDataAndMemory = reduce([
      ...digits("20"), command("memory-store"), command("stat-enter-data"),
      { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, { type: "digit", digit: "3" },
    ]);
    const cleared = reduceCalculator(withDataAndMemory, command("stat-clear"));

    expect(cleared).toMatchObject({ display: "3", accumulator: 2, pendingOperator: "+", memoryValue: 20, statisticsValues: [] });
    expect(reduceCalculator(cleared, { type: "equals" })).toMatchObject({ display: "5", memoryValue: 20, statisticsValues: [] });

    const retainedByClear = reduceCalculator(withDataAndMemory, { type: "clear-entry" });
    const retainedByAc = reduceCalculator(withDataAndMemory, { type: "clear" });
    expect(retainedByClear.statisticsValues).toEqual([20]);
    expect(retainedByAc.statisticsValues).toEqual([20]);

    const errored = reduce([...digits("20"), command("stat-enter-data"), { type: "operator", operator: "/" }, { type: "digit", digit: "0" }, { type: "equals" }]);
    expect(errored).toMatchObject({ display: "Error", statisticsValues: [20] });
    expect(reduceCalculator(errored, { type: "digit", digit: "7" }).statisticsValues).toEqual([20]);
  });

  it("keeps datasets independent between calculator states", () => {
    const first = reduce([...digits("10"), command("stat-enter-data"), ...digits("20"), command("stat-enter-data")]);
    const second = reduce([...digits("100"), command("stat-enter-data")]);

    expect(first.statisticsValues).toEqual([10, 20]);
    expect(second.statisticsValues).toEqual([100]);
    expect(reduceCalculator(first, command("stat-delete-data")).statisticsValues).toEqual([10]);
    expect(second.statisticsValues).toEqual([100]);
  });
});

describe("KCalc statistics query commands", () => {
  it("uses the exact empty-dataset result matrix without disabling query commands", () => {
    expect(reduce([command("stat-count")])).toMatchObject({ display: "0", error: false, statisticsValues: [] });
    expect(reduce([command("stat-sum")])).toMatchObject({ display: "0", error: false, statisticsValues: [] });
    expect(reduce([command("stat-mean")])).toMatchObject({ display: "Error", error: true, statisticsValues: [] });
    expect(reduce([command("stat-sum-squares")])).toMatchObject({ display: "0", error: false, statisticsValues: [] });
    expect(reduce([command("stat-sample-standard-deviation")])).toMatchObject({ display: "Error", error: true, statisticsValues: [] });
    expect(reduce([command("stat-population-standard-deviation")])).toMatchObject({ display: "Error", error: true, statisticsValues: [] });
    expect(reduce([command("stat-median")])).toMatchObject({ display: "Error", error: true, statisticsValues: [] });
  });

  it("returns the complete reference values for [1, 2, 3] and [1, 2, 3, 4] without changing either dataset", () => {
    const first = withStatistics(["1", "2", "3"]);
    const second = withStatistics(["1", "2", "3", "4"]);

    expect(reduceCalculator(first, command("stat-count")).display).toBe("3");
    expect(reduceCalculator(first, command("stat-sum")).display).toBe("6");
    expect(reduceCalculator(first, command("stat-sum-squares")).display).toBe("14");
    expect(reduceCalculator(first, command("stat-mean")).display).toBe("2");
    expect(reduceCalculator(first, command("stat-median")).display).toBe("2");
    expect(Number(reduceCalculator(first, command("stat-sample-standard-deviation")).display)).toBeCloseTo(1);
    expect(Number(reduceCalculator(first, command("stat-population-standard-deviation")).display)).toBeCloseTo(Math.sqrt(2 / 3));

    expect(reduceCalculator(second, command("stat-count")).display).toBe("4");
    expect(reduceCalculator(second, command("stat-sum")).display).toBe("10");
    expect(reduceCalculator(second, command("stat-sum-squares")).display).toBe("30");
    expect(reduceCalculator(second, command("stat-mean")).display).toBe("2.5");
    expect(reduceCalculator(second, command("stat-median")).display).toBe("2.5");
    expect(Number(reduceCalculator(second, command("stat-sample-standard-deviation")).display)).toBeCloseTo(Math.sqrt(5 / 3));
    expect(Number(reduceCalculator(second, command("stat-population-standard-deviation")).display)).toBeCloseTo(Math.sqrt(1.25));
    expect(first.statisticsValues).toEqual([1, 2, 3]);
    expect(second.statisticsValues).toEqual([1, 2, 3, 4]);
  });

  it("handles a single value and preserves insertion order through median followed by CDat", () => {
    const single = withStatistics(["5"]);
    expect(reduceCalculator(single, command("stat-count")).display).toBe("1");
    expect(reduceCalculator(single, command("stat-sum")).display).toBe("5");
    expect(reduceCalculator(single, command("stat-sum-squares")).display).toBe("25");
    expect(reduceCalculator(single, command("stat-mean")).display).toBe("5");
    expect(reduceCalculator(single, command("stat-median")).display).toBe("5");
    expect(reduceCalculator(single, command("stat-sample-standard-deviation")).display).toBe("Error");
    expect(reduceCalculator(single, command("stat-population-standard-deviation")).display).toBe("0");

    const unsorted = withStatistics(["3", "1", "2"]);
    expect(reduceCalculator(unsorted, command("stat-median"))).toMatchObject({ display: "2", statisticsValues: [3, 1, 2] });
    expect(reduceCalculator(unsorted, command("stat-delete-data"))).toMatchObject({ statisticsValues: [3, 1] });
  });

  it("uses query results as the current operand while retaining pending immediate arithmetic", () => {
    const values = withStatistics(["10", "20", "30"]);
    const meanPending = reduceFrom(values, [
      { type: "clear" }, { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, command("stat-mean"), { type: "equals" },
    ]);
    const sumPending = reduceFrom(values, [
      { type: "clear" }, { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, command("stat-sum"), { type: "equals" },
    ]);
    const medianPending = reduceFrom(values, [
      { type: "clear" }, { type: "digit", digit: "2" }, { type: "operator", operator: "+" }, command("stat-median"), { type: "equals" },
    ]);

    expect(meanPending).toMatchObject({ display: "22", statisticsValues: [10, 20, 30] });
    expect(sumPending).toMatchObject({ display: "62", statisticsValues: [10, 20, 30] });
    expect(medianPending).toMatchObject({ display: "22", statisticsValues: [10, 20, 30] });
    expect(reduceFrom(values, [command("stat-mean"), { type: "operator", operator: "+" }, { type: "digit", digit: "2" }, { type: "equals" }]).display).toBe("22");
  });

  it("uses results as fresh entries and lets a following Dat capture the visible query result", () => {
    const values = withStatistics(["1", "2", "3"]);
    const sum = reduceCalculator(values, command("stat-sum"));
    const fresh = reduceCalculator(sum, { type: "digit", digit: "5" });
    const recorded = reduceCalculator(sum, command("stat-enter-data"));

    expect(sum).toMatchObject({ display: "6", waitingForOperand: true, statisticsValues: [1, 2, 3] });
    expect(fresh).toMatchObject({ display: "5", statisticsValues: [1, 2, 3] });
    expect(recorded).toMatchObject({ display: "4", statisticsValues: [1, 2, 3, 6] });
    expect(reduceCalculator(reduceCalculator(values, command("stat-mean")), { type: "digit", digit: "5" }).display).toBe("5");
    expect(reduceCalculator(reduceCalculator(values, command("stat-median")), { type: "digit", digit: "5" }).display).toBe("5");
  });

  it("preserves datasets through query Error recovery, C, AC, memory, and Science commands", () => {
    const values = withStatistics(["1"]);
    const sampleError = reduceCalculator(values, command("stat-sample-standard-deviation"));
    const recovered = reduceCalculator(sampleError, { type: "digit", digit: "5" });
    const stored = reduceCalculator(reduceCalculator(values, command("stat-mean")), command("memory-store"));
    const science = reduceCalculator(values, scienceCommand("sin"));

    expect(sampleError).toMatchObject({ display: "Error", statisticsValues: [1] });
    expect(recovered).toMatchObject({ display: "5", statisticsValues: [1] });
    expect(reduceCalculator(values, { type: "clear-entry" }).statisticsValues).toEqual([1]);
    expect(reduceCalculator(values, { type: "clear" }).statisticsValues).toEqual([1]);
    expect(stored).toMatchObject({ memoryValue: 1, statisticsValues: [1] });
    expect(science.statisticsValues).toEqual([1]);
  });
});

describe("KCalc exact Logic commands", () => {
  it("executes AND, OR, XOR, binary shifts, and complement through command identities", () => {
    expect(reduce([...digits("5"), command("logic-and"), ...digits("3"), { type: "equals" }]).display).toBe("1");
    expect(reduce([...digits("5"), command("logic-or"), ...digits("3"), { type: "equals" }]).display).toBe("7");
    expect(reduce([...digits("5"), command("logic-xor"), ...digits("3"), { type: "equals" }]).display).toBe("6");
    expect(reduce([...digits("1"), command("logic-left-shift"), ...digits("8"), { type: "equals" }]).display).toBe("256");
    expect(reduce([...digits("8"), command("logic-right-shift"), ...digits("1"), { type: "equals" }]).display).toBe("4");
    expect(reduce([{ type: "digit", digit: "5" }, { type: "toggle-sign" }, command("logic-right-shift"), { type: "digit", digit: "1" }, { type: "equals" }]).display).toBe("-2");
    expect(reduce([...digits("255"), command("logic-complement")]).display).toBe("-256");
  });

  it("uses deterministic fraction and Error policies without truncating operand values", () => {
    for (const commandId of ["logic-and", "logic-or", "logic-xor"] as const) {
      expect(reduce([...enteredNumber("5.7"), command(commandId), ...digits("3"), { type: "equals" }]).display).toBe("0");
      expect(reduce([...digits("5"), command(commandId), ...enteredNumber("3.7"), { type: "equals" }]).display).toBe("0");
    }

    expect(reduce([...enteredNumber("1.5"), command("logic-complement")])).toMatchObject({ display: "Error", error: true });
    expect(reduce([...digits("8"), command("logic-left-shift"), ...enteredNumber("1.5"), { type: "equals" }])).toMatchObject({ display: "Error", error: true });
    expect(reduce([...enteredNumber("1.5"), command("logic-right-shift")])).toMatchObject({ display: "Error", error: true });
  });

  it("reverses shifts for negative counts and preserves the accepted immediate execution model", () => {
    expect(reduce([...digits("8"), command("logic-left-shift"), { type: "digit", digit: "1" }, { type: "toggle-sign" }, { type: "equals" }]).display).toBe("4");
    expect(reduce([...digits("8"), command("logic-right-shift"), { type: "digit", digit: "1" }, { type: "toggle-sign" }, { type: "equals" }]).display).toBe("16");
    expect(reduce([...digits("2"), { type: "operator", operator: "+" }, ...digits("5"), command("logic-and"), ...digits("3"), { type: "equals" }]).display).toBe("3");
    expect(reduce([...digits("5"), command("logic-and"), ...digits("3"), { type: "operator", operator: "+" }, ...digits("2"), { type: "equals" }]).display).toBe("3");
  });

  it("keeps exact BigInt logic operands and result presentation across radix bases", () => {
    const largeOr = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("20000000000000", "hex"),
      commandInBase("logic-or", "hex"),
      ...radixDigits("1", "hex"),
      { type: "equals", numberBase: "hex" },
    ]);
    const beyond64Bit = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("10000000000000000", "hex"),
      commandInBase("logic-or", "hex"),
      ...radixDigits("1", "hex"),
      { type: "equals", numberBase: "hex" },
    ]);
    const hexadecimal = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("F", "hex"),
      commandInBase("logic-and", "hex"),
      ...radixDigits("A", "hex"),
      { type: "equals", numberBase: "hex" },
    ]);

    expect(largeOr).toMatchObject({ display: "20000000000001", radixEntry: { base: 16, digits: "20000000000001" } });
    expect(beyond64Bit).toMatchObject({ display: "10000000000000001", radixEntry: { base: 16, digits: "10000000000000001" } });
    expect(hexadecimal.display).toBe("A");
    expect(reduceCalculator(hexadecimal, commandInBase("logic-complement", "hex")).display).toBe("-B");
  });

  it("keeps Logic results usable by safe Number arithmetic while rejecting lossy number-only boundaries", () => {
    const safe = reduce([...digits("5"), command("logic-and"), ...digits("3"), { type: "equals" }, { type: "operator", operator: "+" }, ...digits("2"), { type: "equals" }]);
    const oversized = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("20000000000000", "hex"),
      commandInBase("logic-left-shift", "hex"),
      ...radixDigits("1", "hex"),
      { type: "equals", numberBase: "hex" },
      { type: "operator", operator: "+", numberBase: "hex" },
    ]);

    expect(safe.display).toBe("3");
    expect(oversized).toMatchObject({ display: "Error", error: true });
  });

  it("preserves the standard unary fresh-entry and arithmetic-pending contracts", () => {
    const complemented = reduce([...digits("5"), command("logic-complement")]);
    const fresh = reduceCalculator(complemented, { type: "digit", digit: "2" });
    const pending = reduce([
      ...digits("2"),
      { type: "operator", operator: "+" },
      { type: "digit", digit: "1" },
      command("logic-complement"),
      { type: "equals" },
    ]);

    expect(complemented.display).toBe("-6");
    expect(fresh.display).toBe("2");
    expect(pending.display).toBe("0");
  });

  it("keeps exact pending Logic operands isolated between calculator states", () => {
    const first = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("20000000000000", "hex"),
      commandInBase("logic-or", "hex"),
    ]);
    const second = reduce([...digits("5"), command("logic-xor")]);
    const firstComplete = reduceFrom(first, [...radixDigits("1", "hex"), { type: "equals", numberBase: "hex" }]);
    const secondComplete = reduceFrom(second, [...digits("3"), { type: "equals" }]);

    expect(firstComplete.display).toBe("20000000000001");
    expect(secondComplete.display).toBe("6");
  });

  it("uses ordinary C, AC, Error, memory, and Statistics boundaries without changing their authorities", () => {
    const pending = reduce([...digits("5"), command("logic-and"), { type: "clear-entry" }, ...digits("3"), { type: "equals" }]);
    const cleared = reduce([...digits("5"), command("logic-and"), { type: "clear" }, ...digits("3"), { type: "equals" }]);
    const error = reduce([...enteredNumber("1.5"), command("logic-complement")]);
    const recovered = reduceCalculator(error, { type: "digit", digit: "5" });
    const memory = reduce([...digits("10"), command("memory-store"), command("memory-recall"), command("logic-and"), ...digits("3"), { type: "equals" }]);
    const statistics = reduce([
      ...digits("5"), command("stat-enter-data"),
      ...digits("5"), command("stat-enter-data"),
      command("stat-mean"), command("logic-and"), ...digits("3"), { type: "equals" },
    ]);

    expect(pending.display).toBe("1");
    expect(cleared.display).toBe("3");
    expect(error).toMatchObject({ display: "Error", error: true });
    expect(recovered.display).toBe("5");
    expect(memory).toMatchObject({ display: "2", memoryValue: 10 });
    expect(statistics).toMatchObject({ display: "1", statisticsValues: [5, 5] });
  });
});

describe("KCalc exact integer domain availability", () => {
  const radixValue = (value: string, numberBase: "hex" | "octal" | "binary") => reduce([
    { type: "set-base", numberBase },
    ...radixDigits(value, numberBase),
  ]);

  it("classifies exact magnitude rather than radix or digit count", () => {
    const hexadecimalSafe = radixValue("1FFFFFFFFFFFFF", "hex");
    const hexadecimalUnsafe = radixValue("20000000000000", "hex");
    const octalSafe = radixValue("377777777777777777", "octal");
    const octalUnsafe = radixValue("400000000000000000", "octal");
    const binarySafe = radixValue("1".repeat(53), "binary");
    const binaryUnsafe = radixValue(`1${"0".repeat(53)}`, "binary");
    const binaryUserExample = radixValue("1000000000000000000", "binary");

    expect(classifyCalculatorOperandDomain(reduce([...digits("12"), { type: "decimal" }, { type: "digit", digit: "5" }]))).toBe("number-compatible");
    expect(classifyCalculatorOperandDomain(hexadecimalSafe)).toBe("number-compatible");
    expect(classifyCalculatorOperandDomain(hexadecimalUnsafe)).toBe("exact-integer-only");
    expect(classifyCalculatorOperandDomain(octalSafe)).toBe("number-compatible");
    expect(classifyCalculatorOperandDomain(octalUnsafe)).toBe("exact-integer-only");
    expect(classifyCalculatorOperandDomain(binarySafe)).toBe("number-compatible");
    expect(classifyCalculatorOperandDomain(binaryUnsafe)).toBe("exact-integer-only");
    expect(canCurrentCalculatorValueEnterNumberDomain(binaryUserExample)).toBe(true);
  });

  it("keeps safe radix values in number commands while disabling only unsafe exact consumers", () => {
    const safe = radixValue("1FFFFFFFFFFFFF", "hex");
    const unsafe = radixValue("20000000000000", "hex");

    expect(isCalculatorActionEnabled(safe, { type: "operator", operator: "+" })).toBe(true);
    for (const operator of ["+", "-", "*", "/"] as const) {
      expect(isCalculatorActionEnabled(unsafe, { type: "operator", operator })).toBe(false);
    }
    for (const commandId of [
      "mod", "int-div", "reciprocal", "factorial", "square", "cube", "sqrt", "cuberoot", "power", "inverse-power", "percent",
      "memory-store", "memory-add", "memory-subtract", "stat-enter-data", "sin", "log10",
    ]) {
      expect(isCalculatorCommandEnabled(unsafe, commandId)).toBe(false);
    }
    for (const commandId of ["logic-and", "logic-or", "logic-xor", "logic-left-shift", "logic-right-shift", "logic-complement", "stat-count", "stat-mean", "stat-median", "stat-clear"]) {
      expect(isCalculatorCommandEnabled(unsafe, commandId)).toBe(true);
    }
  });

  it("keeps independent memory and Statistics controls available according to their own authorities", () => {
    const memoryAndStatistics = reduce([
      ...digits("1"), command("memory-store"), command("stat-enter-data"),
      { type: "set-base", numberBase: "hex" }, ...radixDigits("20000000000000", "hex"),
    ]);
    const emptyStatistics = radixValue("20000000000000", "hex");

    expect(isCalculatorCommandEnabled(memoryAndStatistics, "memory-recall")).toBe(true);
    expect(isCalculatorCommandEnabled(memoryAndStatistics, "memory-clear")).toBe(true);
    expect(isCalculatorCommandEnabled(memoryAndStatistics, "stat-delete-data")).toBe(true);
    expect(isCalculatorCommandEnabled(emptyStatistics, "stat-delete-data")).toBe(false);
    expect(isCalculatorCommandEnabled(memoryAndStatistics, "stat-sum")).toBe(true);
    expect(isCalculatorCommandEnabled(memoryAndStatistics, "stat-clear-inverse-noop")).toBe(true);
  });

  it("keeps exact Logic equals enabled while blocking an unsafe right operand for number arithmetic", () => {
    const logicPending = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("20000000000000", "hex"), commandInBase("logic-or", "hex"), ...radixDigits("1", "hex"),
    ]);
    const numberPending = reduce([
      ...digits("1"), { type: "operator", operator: "+" },
      { type: "set-base", numberBase: "hex" }, ...radixDigits("20000000000000", "hex"),
    ]);

    expect(isCalculatorActionEnabled(logicPending, { type: "equals" })).toBe(true);
    expect(reduceCalculator(logicPending, { type: "equals", numberBase: "hex" }).display).toBe("20000000000001");
    expect(isCalculatorActionEnabled(numberPending, { type: "equals" })).toBe(false);
    expect(reduceCalculator(numberPending, { type: "equals", numberBase: "hex" })).toMatchObject({ display: "Error", error: true });
  });

  it("restores number command availability after a safe fresh entry without changing Base or exact conversion", () => {
    const hexadecimal = radixValue("20000000000000", "hex");
    const decimal = reduceCalculator(hexadecimal, { type: "set-base", numberBase: "decimal" });
    const safe = reduceCalculator(decimal, { type: "digit", digit: "5", numberBase: "decimal" });

    expect(decimal).toMatchObject({ display: "9007199254740992", radixEntry: { base: 10, digits: "9007199254740992" } });
    expect(isCalculatorActionEnabled(decimal, { type: "operator", operator: "*" })).toBe(false);
    expect(isCalculatorCommandEnabled(decimal, "sin")).toBe(false);
    expect(safe.display).toBe("5");
    expect(isCalculatorActionEnabled(safe, { type: "operator", operator: "*" })).toBe(true);
    expect(isCalculatorCommandEnabled(safe, "sin")).toBe(true);
  });

  it("allows the safe binary user example while preserving defensive core rejection for an unsafe bypass", () => {
    const binary = reduce([
      { type: "set-base", numberBase: "binary" },
      ...radixDigits("1000000000000000000", "binary"),
      { type: "operator", operator: "*", numberBase: "binary" },
      ...radixDigits("10", "binary"),
      { type: "equals", numberBase: "binary" },
    ]);
    const unsafe = radixValue("1000000000000000000", "hex");

    expect(binary.display).toBe("10000000000000000000");
    expect(reduceCalculator(unsafe, { type: "operator", operator: "*", numberBase: "hex" })).toMatchObject({ display: "Error", error: true });
  });

  it("derives availability per calculator state without a shared Base or domain flag", () => {
    const first = radixValue("20000000000000", "hex");
    const second = radixValue("FF", "hex");

    expect(isCalculatorActionEnabled(first, { type: "operator", operator: "+" })).toBe(false);
    expect(isCalculatorActionEnabled(second, { type: "operator", operator: "+" })).toBe(true);
  });
});

describe("KCalc result history reducer integration", () => {
  const historyCommand = (commandId: "edit-undo" | "edit-redo", numberBase: "decimal" | "hex" | "octal" | "binary" = "decimal") =>
    commandInBase(commandId, numberBase);

  it("records only successful, completed nonzero equals results", () => {
    const positive = reduce([...digits("2"), { type: "operator", operator: "+" }, ...digits("3"), { type: "equals" }]);
    const zero = reduce([...digits("2"), { type: "operator", operator: "-" }, ...digits("2"), { type: "equals" }]);
    const fraction = reduce([{ type: "digit", digit: "1" }, { type: "operator", operator: "/" }, { type: "digit", digit: "2" }, { type: "equals" }]);
    const negative = reduce([{ type: "digit", digit: "2" }, { type: "operator", operator: "-" }, { type: "digit", digit: "5" }, { type: "equals" }]);

    expect(positive.resultHistory.values).toEqual([5]);
    expect(zero.resultHistory.values).toEqual([]);
    expect(fraction.resultHistory.values).toEqual([0.5]);
    expect(negative.resultHistory.values).toEqual([-3]);
    expect(reduce([...digits("5"), { type: "equals" }]).resultHistory.values).toEqual([]);
  });

  it("retains exact Logic equals results without a Number roundtrip", () => {
    const result = reduce([
      { type: "set-base", numberBase: "hex" },
      ...radixDigits("20000000000000", "hex"), commandInBase("logic-or", "hex"), ...radixDigits("1", "hex"), { type: "equals", numberBase: "hex" },
    ]);

    expect(result.display).toBe("20000000000001");
    expect(result.resultHistory.values).toEqual([0x20000000000001n]);
  });

  it("replays KDE3's first Undo quirk while preserving pending calculator state", () => {
    const results = reduce([
      ...digits("2"), { type: "operator", operator: "+" }, ...digits("3"), { type: "equals" },
      { type: "operator", operator: "+" }, ...digits("3"), { type: "equals" },
      { type: "operator", operator: "+" }, ...digits("4"), { type: "equals" },
    ]);
    const pending = reduceCalculator(results, { type: "operator", operator: "+" });
    const firstUndo = reduceCalculator(pending, historyCommand("edit-undo"));
    const secondUndo = reduceCalculator(firstUndo, historyCommand("edit-undo"));
    const redo = reduceCalculator(secondUndo, historyCommand("edit-redo"));

    expect(results.resultHistory.values).toEqual([12, 8, 5]);
    expect(firstUndo).toMatchObject({ display: "12", accumulator: 12, pendingOperator: "+", waitingForOperand: true, hasCurrentOperand: true });
    expect(secondUndo.display).toBe("8");
    expect(redo.display).toBe("8");
  });

  it("renders history through the current Base and keeps its exact value", () => {
    const decimal = reduce([...digits("2"), { type: "operator", operator: "+" }, ...digits("253"), { type: "equals" }]);
    const hexadecimal = reduceCalculator(decimal, { type: "set-base", numberBase: "hex" });
    const history = reduceCalculator(hexadecimal, historyCommand("edit-undo", "hex"));

    expect(history.display).toBe("FF");
    expect(history.resultHistory.values).toEqual([255]);
    expect(reduceCalculator(history, { type: "digit", digit: "A", numberBase: "hex" }).display).toBe("A");
  });

  it("does not record unary, query, constant, or clipboard display changes", () => {
    const statistics = withStatistics(["1", "2", "3"]);
    const afterUnary = reduceCalculator(reduce([{ type: "digit", digit: "5" }, { type: "command", commandId: "logic-complement" }]), command("sin"));
    const afterQuery = reduceCalculator(statistics, command("stat-mean"));
    const afterConstant = reduceCalculator(afterQuery, {
      type: "command",
      commandId: "constant-1",
      context: { angleUnit: "degrees", numberBase: "decimal", constantValue: { kind: "number", value: 42 } },
    });
    const afterPaste = reduceCalculator(afterConstant, { type: "clipboard-paste", text: "7", numberBase: "decimal" });

    expect(afterUnary.resultHistory.values).toEqual([]);
    expect(afterPaste.resultHistory.values).toEqual([]);
  });

  it("follows the historical EnterEqual path for MS, M+, and M- without rolling back memory", () => {
    const stored = reduce([...digits("5"), command("memory-store")]);
    const added = reduce([...digits("5"), command("memory-add")]);
    const subtracted = reduce([...digits("5"), command("memory-subtract")]);

    expect(stored).toMatchObject({ memoryValue: 5, resultHistory: { values: [5] } });
    expect(added).toMatchObject({ memoryValue: 5, resultHistory: { values: [5] } });
    expect(subtracted).toMatchObject({ memoryValue: -5, resultHistory: { values: [5] } });
  });

  it("keeps history through Error and clear actions without making it persistent calculator state", () => {
    const result = reduce([...digits("2"), { type: "operator", operator: "+" }, ...digits("3"), { type: "equals" }]);
    const error = reduceFrom(result, [{ type: "operator", operator: "/" }, { type: "digit", digit: "0" }, { type: "equals" }]);
    const cleared = reduceCalculator(error, { type: "clear" });

    expect(error.resultHistory.values).toEqual([5]);
    expect(cleared.resultHistory.values).toEqual([5]);
    expect(reduceCalculator(cleared, historyCommand("edit-undo")).display).toBe("5");
  });

  it("does not roll back memory, Statistics, or a pending Logic operator", () => {
    const withSharedState = reduce([
      ...digits("5"), command("memory-store"), command("stat-enter-data"),
      { type: "operator", operator: "+" }, ...digits("2"), { type: "equals" },
    ]);
    const pendingLogic = reduceCalculator(withSharedState, command("logic-or"));
    const restored = reduceCalculator(pendingLogic, historyCommand("edit-undo"));

    expect(restored).toMatchObject({
      display: "3",
      memoryValue: 5,
      statisticsValues: [5],
      pendingLogicOperator: "logic-or",
      logicPendingOperand: { kind: "exact", value: 3n },
    });
  });

  it("derives Undo and Redo availability from each exact calculator history", () => {
    const result = reduce([...digits("2"), { type: "operator", operator: "+" }, ...digits("3"), { type: "equals" }]);
    const afterUndo = reduceCalculator(result, historyCommand("edit-undo"));

    expect(isCalculatorCommandEnabled(initialCalculatorState, "edit-undo")).toBe(false);
    expect(isCalculatorCommandEnabled(initialCalculatorState, "edit-redo")).toBe(false);
    expect(isCalculatorCommandEnabled(result, "edit-undo")).toBe(true);
    expect(isCalculatorCommandEnabled(result, "edit-redo")).toBe(false);
    expect(isCalculatorCommandEnabled(afterUndo, "edit-undo")).toBe(false);
    expect(isCalculatorCommandEnabled(afterUndo, "edit-redo")).toBe(true);
  });
});

describe("calculator instance state isolation", () => {
  it("keeps independent displays and pending operators when two calculator states interleave", () => {
    const firstPending = reduce([...digits("10"), { type: "operator", operator: "+" }]);
    const secondPending = reduce([...digits("8"), { type: "operator", operator: "*" }]);
    const firstCompleted = reduceCalculator(reduceCalculator(firstPending, { type: "digit", digit: "2" }), { type: "equals" });
    const secondCompleted = reduceCalculator(reduceCalculator(secondPending, { type: "digit", digit: "3" }), { type: "equals" });

    expect(firstPending).toMatchObject({ display: "10", accumulator: 10, pendingOperator: "+", waitingForOperand: true });
    expect(secondPending).toMatchObject({ display: "8", accumulator: 8, pendingOperator: "*", waitingForOperand: true });
    expect(firstCompleted.display).toBe("12");
    expect(secondCompleted.display).toBe("24");
    expect(firstCompleted.resultHistory.values).toEqual([12]);
    expect(secondCompleted.resultHistory.values).toEqual([24]);
  });

  it("keeps decimal, sign, error, and clear transitions local to each reducer state", () => {
    const first = reduce([{ type: "digit", digit: "1" }, { type: "decimal" }, { type: "digit", digit: "5" }, { type: "toggle-sign" }]);
    const secondError = reduce([{ type: "digit", digit: "1" }, { type: "operator", operator: "/" }, { type: "digit", digit: "0" }, { type: "equals" }]);
    const secondCleared = reduceCalculator(secondError, { type: "clear" });

    expect(first).toMatchObject({ display: "-1.5", error: false });
    expect(secondError).toMatchObject({ display: "Error", error: true });
    expect(secondCleared).toBe(initialCalculatorState);
    expect(first.display).toBe("-1.5");
  });
});
