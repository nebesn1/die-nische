import { describe, expect, it } from "vitest";
import { formatKCalcClipboardValue, parseKCalcClipboardText } from "./kcalcClipboard";

describe("KCalc clipboard radix boundary", () => {
  it("formats canonical decimal and historical radix clipboard text without Number precision loss", () => {
    expect(formatKCalcClipboardValue({ kind: "number", value: 255 }, "decimal")).toBe("255");
    expect(formatKCalcClipboardValue({ kind: "number", value: 6.6742e-11 }, "decimal")).toBe("6.6742e-11");
    expect(formatKCalcClipboardValue({ kind: "integer", value: 255n }, "hex")).toBe("0xFF");
    expect(formatKCalcClipboardValue({ kind: "integer", value: -10n }, "hex")).toBe("-0xA");
    expect(formatKCalcClipboardValue({ kind: "integer", value: 255n }, "octal")).toBe("377");
    expect(formatKCalcClipboardValue({ kind: "integer", value: 255n }, "binary")).toBe("11111111");
    expect(formatKCalcClipboardValue({ kind: "integer", value: 9007199254740993n }, "decimal")).toBe("9007199254740993");
    expect(formatKCalcClipboardValue({ kind: "integer", value: 9007199254740993n }, "hex")).toBe("0x20000000000001");
  });

  it("parses current-base text, explicit hexadecimal, decimal scientific text, and exact integers", () => {
    expect(parseKCalcClipboardText("  123  ", "decimal")).toEqual({ kind: "number", value: 123 });
    expect(parseKCalcClipboardText("6.6742E-11", "decimal")).toEqual({ kind: "number", value: 6.6742e-11 });
    expect(parseKCalcClipboardText("9007199254740993", "decimal")).toEqual({ kind: "integer", value: 9007199254740993n });
    expect(parseKCalcClipboardText("FF", "hex")).toEqual({ kind: "integer", value: 255n });
    expect(parseKCalcClipboardText("0XFF", "binary")).toEqual({ kind: "integer", value: 255n });
    expect(parseKCalcClipboardText("-0xA", "decimal")).toEqual({ kind: "integer", value: -10n });
    expect(parseKCalcClipboardText("0x-A", "decimal")).toEqual({ kind: "integer", value: -10n });
    expect(parseKCalcClipboardText("377", "octal")).toEqual({ kind: "integer", value: 255n });
    expect(parseKCalcClipboardText("1010", "binary")).toEqual({ kind: "integer", value: 10n });
  });

  it("rejects unsupported grammar without treating binary or octal prefixes specially", () => {
    expect(parseKCalcClipboardText("", "decimal")).toBeNull();
    expect(parseKCalcClipboardText("FF", "decimal")).toBeNull();
    expect(parseKCalcClipboardText("1.5", "hex")).toBeNull();
    expect(parseKCalcClipboardText("6.6742e-11", "hex")).toBeNull();
    expect(parseKCalcClipboardText("8", "octal")).toBeNull();
    expect(parseKCalcClipboardText("2", "binary")).toBeNull();
    expect(parseKCalcClipboardText("0o377", "decimal")).toBeNull();
    expect(parseKCalcClipboardText("0b1010", "binary")).toBeNull();
  });
});
