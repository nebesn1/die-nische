import { describe, expect, it } from "vitest";
import { formatDateDDMMYY, formatTime24, formatTime24WithSeconds, formatWeekdayShort, getClockParts } from "./timeFormat";

describe("time formatting", () => {
  it("formats 24 hour time", () => {
    expect(formatTime24(new Date(2026, 6, 31, 14, 7, 3))).toBe("14:07");
  });

  it("formats dates as DD/MM/YY", () => {
    expect(formatDateDDMMYY(new Date(2026, 6, 31, 14, 7, 3))).toBe("31/07/26");
  });

  it("adds leading zeroes to single digit days and months", () => {
    expect(formatDateDDMMYY(new Date(2026, 0, 4, 8, 0, 0))).toBe("04/01/26");
  });

  it("formats midnight as 00:00", () => {
    expect(formatTime24(new Date(2026, 6, 31, 0, 0, 0))).toBe("00:00");
  });

  it("formats 23:59 correctly", () => {
    expect(formatTime24(new Date(2026, 6, 31, 23, 59, 59))).toBe("23:59");
  });

  it("formats seconds and a short English weekday without locale variation", () => {
    const date = new Date(2026, 6, 31, 23, 59, 59);

    expect(formatTime24WithSeconds(date)).toBe("23:59:59");
    expect(formatWeekdayShort(date)).toBe("Fri");
    expect(getClockParts(date)).toMatchObject({ seconds: "59", weekday: "Fri", readableTimeWithSeconds: "23:59:59" });
  });
});
