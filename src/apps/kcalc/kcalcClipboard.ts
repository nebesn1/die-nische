import {
  createKCalcRadixEntry,
  formatKCalcRadixInteger,
  getKCalcRadix,
  getKCalcRadixEntryValue,
  getKCalcSafeNumber,
  truncateFiniteNumberForKCalcRadix,
} from "./kcalcRadix";
import type { KCalcNumberBase } from "./kcalcModeState";

export type KCalcClipboardValue =
  | Readonly<{ kind: "number"; value: number }>
  | Readonly<{ kind: "integer"; value: bigint }>;

const isFiniteDecimalText = (text: string): boolean =>
  /^[+-]?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(text);

const formatSignedHex = (value: bigint): string => {
  const magnitude = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}0x${magnitude.toString(16).toUpperCase()}`;
};

export function formatKCalcClipboardValue(value: KCalcClipboardValue, numberBase: KCalcNumberBase): string | null {
  if (value.kind === "number") {
    if (!Number.isFinite(value.value)) {
      return null;
    }

    if (numberBase === "decimal") {
      return Object.is(value.value, -0) || value.value === 0 ? "0" : value.value.toString();
    }

    const integerValue = truncateFiniteNumberForKCalcRadix(value.value);
    return integerValue === null ? null : formatKCalcClipboardValue({ kind: "integer", value: integerValue }, numberBase);
  }

  if (numberBase === "decimal") {
    return value.value.toString();
  }

  if (numberBase === "hex") {
    return formatSignedHex(value.value);
  }

  return formatKCalcRadixInteger(value.value, getKCalcRadix(numberBase));
}

const parseHexPrefix = (text: string): bigint | null => {
  const normalized = text.match(/^([+-]?)0x([0-9a-f]+)$/i) ?? text.match(/^0x-([0-9a-f]+)$/i);

  if (normalized === null) {
    return null;
  }

  try {
    if (normalized.length === 2) {
      return -BigInt(`0x${normalized[1]}`);
    }

    const value = BigInt(`0x${normalized[2]}`);
    return normalized[1] === "-" ? -value : value;
  } catch {
    return null;
  }
};

const parseDecimalClipboardValue = (text: string): KCalcClipboardValue | null => {
  if (/^[+-]?\d+$/.test(text)) {
    try {
      const value = BigInt(text);
      const safeNumber = getKCalcSafeNumber(value);
      return safeNumber === null ? { kind: "integer", value } : { kind: "number", value: safeNumber };
    } catch {
      return null;
    }
  }

  if (!isFiniteDecimalText(text)) {
    return null;
  }

  const value = Number(text);
  return Number.isFinite(value) ? { kind: "number", value } : null;
};

export function parseKCalcClipboardText(text: string, numberBase: KCalcNumberBase): KCalcClipboardValue | null {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const hexPrefixed = parseHexPrefix(trimmed);

  if (hexPrefixed !== null) {
    return { kind: "integer", value: hexPrefixed };
  }

  if (numberBase === "decimal") {
    return parseDecimalClipboardValue(trimmed);
  }

  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const digits = trimmed.startsWith("-") || trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  const entry = createKCalcRadixEntry(getKCalcRadix(numberBase), sign < 0n, digits);

  return entry === null ? null : { kind: "integer", value: getKCalcRadixEntryValue(entry) };
}
