import { describe, expect, it } from "vitest";
import { clampKonquerorMediaTime, formatKonquerorMediaTime, normalizeKonquerorVolume } from "./mediaTime";

describe("Konqueror media time and volume helpers", () => {
  it("formats compact elapsed and duration labels deterministically", () => {
    expect(formatKonquerorMediaTime(0)).toBe("00:00");
    expect(formatKonquerorMediaTime(65)).toBe("01:05");
    expect(formatKonquerorMediaTime(3661)).toBe("1:01:01");
    expect(formatKonquerorMediaTime(null)).toBe("--:--");
    expect(formatKonquerorMediaTime(Number.NaN)).toBe("--:--");
    expect(formatKonquerorMediaTime(Number.POSITIVE_INFINITY)).toBe("--:--");
  });

  it("keeps media time finite, non-negative, and within known duration", () => {
    expect(clampKonquerorMediaTime(-4, 20)).toBe(0);
    expect(clampKonquerorMediaTime(25, 20)).toBe(20);
    expect(clampKonquerorMediaTime(Number.NaN, 20)).toBe(0);
    expect(clampKonquerorMediaTime(25, null)).toBe(25);
  });

  it("normalizes volume without allowing non-finite values", () => {
    expect(normalizeKonquerorVolume(-1)).toBe(0);
    expect(normalizeKonquerorVolume(0.4)).toBe(0.4);
    expect(normalizeKonquerorVolume(2)).toBe(1);
    expect(normalizeKonquerorVolume(Number.NaN)).toBe(0);
  });
});
