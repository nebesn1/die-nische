import { describe, expect, it } from "vitest";
import {
  appendKCalcRadixDigit,
  createKCalcRadixEntry,
  createKCalcRadixEntryFromValue,
  formatKCalcRadixInteger,
  getKCalcRadix,
  getKCalcRadixEntryValue,
  getKCalcSafeNumber,
  isKCalcRadixDigit,
  normalizeKCalcRadixDigits,
  toggleKCalcRadixEntrySign,
  truncateFiniteNumberForKCalcRadix,
} from "./kcalcRadix";

describe("KCalc radix helpers", () => {
  it("maps every visible number base to its radix", () => {
    expect(getKCalcRadix("decimal")).toBe(10);
    expect(getKCalcRadix("hex")).toBe(16);
    expect(getKCalcRadix("octal")).toBe(8);
    expect(getKCalcRadix("binary")).toBe(2);
  });

  it("provides the KDE3 digit availability matrix", () => {
    expect(isKCalcRadixDigit("9", 10)).toBe(true);
    expect(isKCalcRadixDigit("A", 10)).toBe(false);
    expect(isKCalcRadixDigit("F", 16)).toBe(true);
    expect(isKCalcRadixDigit("8", 8)).toBe(false);
    expect(isKCalcRadixDigit("7", 8)).toBe(true);
    expect(isKCalcRadixDigit("2", 2)).toBe(false);
    expect(isKCalcRadixDigit("1", 2)).toBe(true);
  });

  it("formats the positive conversion matrix with uppercase, unprefixed digits", () => {
    expect(formatKCalcRadixInteger(10n, 16)).toBe("A");
    expect(formatKCalcRadixInteger(15n, 8)).toBe("17");
    expect(formatKCalcRadixInteger(16n, 2)).toBe("10000");
    expect(formatKCalcRadixInteger(255n, 16)).toBe("FF");
    expect(formatKCalcRadixInteger(256n, 8)).toBe("400");
  });

  it("uses deterministic signed-magnitude formatting and normalizes negative zero", () => {
    expect(formatKCalcRadixInteger(-10n, 16)).toBe("-A");
    expect(formatKCalcRadixInteger(-10n, 8)).toBe("-12");
    expect(formatKCalcRadixInteger(-10n, 2)).toBe("-1010");
    expect(createKCalcRadixEntry(16, true, "0000")).toEqual({ base: 16, negative: false, digits: "0" });
  });

  it("normalizes leading zeroes and appends only valid digits", () => {
    expect(normalizeKCalcRadixDigits("000A")).toBe("A");
    const entry = createKCalcRadixEntry(16, false, "00A")!;
    expect(appendKCalcRadixDigit(entry, "f")).toEqual({ base: 16, negative: false, digits: "AF" });
    expect(appendKCalcRadixDigit(entry, "G")).toBeNull();
    expect(toggleKCalcRadixEntrySign(entry)).toEqual({ base: 16, negative: true, digits: "A" });
  });

  it("round-trips integers beyond Number.MAX_SAFE_INTEGER exactly", () => {
    const value = 9007199254740993n;
    const entry = createKCalcRadixEntryFromValue(value, 16);

    expect(entry).toEqual({ base: 16, negative: false, digits: "20000000000001" });
    expect(getKCalcRadixEntryValue(entry)).toBe(value);
    expect(formatKCalcRadixInteger(value, 8)).toBe("400000000000000001");
    expect(formatKCalcRadixInteger(value, 2)).toBe("100000000000000000000000000000000000000000000000000001");
    expect(getKCalcSafeNumber(value)).toBeNull();
  });

  it("truncates finite number values toward zero only at the explicit radix boundary", () => {
    expect(truncateFiniteNumberForKCalcRadix(12.75)).toBe(12n);
    expect(truncateFiniteNumberForKCalcRadix(-12.75)).toBe(-12n);
    expect(truncateFiniteNumberForKCalcRadix(Number.POSITIVE_INFINITY)).toBeNull();
    expect(truncateFiniteNumberForKCalcRadix(9007199254740992)).toBeNull();
  });
});
