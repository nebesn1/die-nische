import { describe, expect, it } from "vitest";
import {
  MAX_KCALC_LOGIC_SHIFT_BITS,
  evaluateKCalcLogicBinaryCommand,
  evaluateKCalcLogicComplement,
  isKCalcLogicBinaryCommand,
  isKCalcLogicCommand,
} from "./kcalcLogicMath";

describe("KCalc exact logic evaluator", () => {
  it("uses arbitrary-precision bigint operands for AND, OR, XOR, and complement", () => {
    expect(evaluateKCalcLogicBinaryCommand("logic-and", 5n, 3n)).toBe(1n);
    expect(evaluateKCalcLogicBinaryCommand("logic-or", 5n, 3n)).toBe(7n);
    expect(evaluateKCalcLogicBinaryCommand("logic-xor", 5n, 3n)).toBe(6n);
    expect(evaluateKCalcLogicComplement(0n)).toBe(-1n);
    expect(evaluateKCalcLogicComplement(1n)).toBe(-2n);
    expect(evaluateKCalcLogicComplement(-1n)).toBe(0n);
    expect(evaluateKCalcLogicComplement(255n)).toBe(-256n);
  });

  it("keeps logic exact beyond 32 and 64 bits without a fixed-width mask", () => {
    expect(evaluateKCalcLogicBinaryCommand("logic-or", 0x20000000000000n, 1n)).toBe(0x20000000000001n);
    expect(evaluateKCalcLogicBinaryCommand("logic-or", 0x10000000000000000n, 1n)).toBe(0x10000000000000001n);
  });

  it("implements binary shifts, negative-count reversal, and truncation toward zero", () => {
    expect(evaluateKCalcLogicBinaryCommand("logic-left-shift", 1n, 8n)).toBe(256n);
    expect(evaluateKCalcLogicBinaryCommand("logic-right-shift", 8n, 1n)).toBe(4n);
    expect(evaluateKCalcLogicBinaryCommand("logic-right-shift", 9n, 1n)).toBe(4n);
    expect(evaluateKCalcLogicBinaryCommand("logic-right-shift", -5n, 1n)).toBe(-2n);
    expect(evaluateKCalcLogicBinaryCommand("logic-left-shift", 8n, -1n)).toBe(4n);
    expect(evaluateKCalcLogicBinaryCommand("logic-right-shift", 8n, -1n)).toBe(16n);
    expect(evaluateKCalcLogicBinaryCommand("logic-left-shift", 1n, 100n)).toBe(2n ** 100n);
  });

  it("rejects deterministic shifts beyond the resource-safe bound", () => {
    expect(evaluateKCalcLogicBinaryCommand("logic-left-shift", 1n, BigInt(MAX_KCALC_LOGIC_SHIFT_BITS) + 1n)).toBeNull();
  });

  it("identifies only the stable Logic command identities", () => {
    expect(isKCalcLogicBinaryCommand("logic-and")).toBe(true);
    expect(isKCalcLogicCommand("logic-complement")).toBe(true);
    expect(isKCalcLogicCommand("AND")).toBe(false);
  });
});
