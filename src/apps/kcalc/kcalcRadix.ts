import type { KCalcNumberBase } from "./kcalcModeState";

export type KCalcRadix = 2 | 8 | 10 | 16;

export type KCalcRadixEntry = Readonly<{
  base: KCalcRadix;
  negative: boolean;
  digits: string;
}>;

const digitAlphabet = "0123456789ABCDEF";

const radixByNumberBase: Readonly<Record<KCalcNumberBase, KCalcRadix>> = {
  binary: 2,
  octal: 8,
  decimal: 10,
  hex: 16,
};

export function getKCalcRadix(numberBase: KCalcNumberBase): KCalcRadix {
  return radixByNumberBase[numberBase];
}

export function isKCalcRadixDigit(digit: string, base: KCalcRadix): boolean {
  return digit.length === 1 && digitAlphabet.slice(0, base).includes(digit.toUpperCase());
}

export function normalizeKCalcRadixDigits(digits: string): string | null {
  const normalized = digits.toUpperCase();

  if (!/^[0-9A-F]+$/.test(normalized)) {
    return null;
  }

  const withoutLeadingZeroes = normalized.replace(/^0+(?=.)/, "");
  return withoutLeadingZeroes === "" ? "0" : withoutLeadingZeroes;
}

export function createKCalcRadixEntry(base: KCalcRadix, negative: boolean, digits: string): KCalcRadixEntry | null {
  const normalizedDigits = normalizeKCalcRadixDigits(digits);

  if (normalizedDigits === null || [...normalizedDigits].some((digit) => !isKCalcRadixDigit(digit, base))) {
    return null;
  }

  return {
    base,
    negative: normalizedDigits === "0" ? false : negative,
    digits: normalizedDigits,
  };
}

export function getKCalcRadixEntryValue(entry: KCalcRadixEntry): bigint {
  const value = BigInt(`${entry.base === 16 ? "0x" : entry.base === 8 ? "0o" : entry.base === 2 ? "0b" : ""}${entry.digits}`);
  return entry.negative ? -value : value;
}

export function formatKCalcRadixInteger(value: bigint, base: KCalcRadix): string {
  if (value === 0n) {
    return "0";
  }

  const magnitude = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${magnitude.toString(base).toUpperCase()}`;
}

export function createKCalcRadixEntryFromValue(value: bigint, base: KCalcRadix): KCalcRadixEntry {
  const formatted = formatKCalcRadixInteger(value, base);
  return {
    base,
    negative: formatted.startsWith("-"),
    digits: formatted.startsWith("-") ? formatted.slice(1) : formatted,
  };
}

export function appendKCalcRadixDigit(entry: KCalcRadixEntry, digit: string): KCalcRadixEntry | null {
  if (!isKCalcRadixDigit(digit, entry.base)) {
    return null;
  }

  return createKCalcRadixEntry(entry.base, entry.negative, `${entry.digits}${digit.toUpperCase()}`);
}

export function removeKCalcRadixDigit(entry: KCalcRadixEntry): KCalcRadixEntry {
  return createKCalcRadixEntry(entry.base, entry.negative, entry.digits.slice(0, -1) || "0")!;
}

export function toggleKCalcRadixEntrySign(entry: KCalcRadixEntry): KCalcRadixEntry {
  return { ...entry, negative: entry.digits === "0" ? false : !entry.negative };
}

export function truncateFiniteNumberForKCalcRadix(value: number): bigint | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const truncated = Math.trunc(value);
  return Number.isSafeInteger(truncated) ? BigInt(truncated) : null;
}

export function getKCalcSafeNumber(value: bigint): number | null {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}
