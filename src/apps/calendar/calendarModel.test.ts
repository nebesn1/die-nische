import { describe, expect, it } from "vitest";
import {
  getCalendarMonthGrid,
  getDaysInMonth,
  getIsoWeekNumber,
  getLocalizedMonthName,
  getLocalizedWeekdayLabels,
  isSameCalendarDate,
  shiftCalendarMonth,
  shiftCalendarYear,
} from "./calendarModel";

describe("calendarModel", () => {
  it("builds the Sunday-first September 2026 grid with adjacent days", () => {
    const grid = getCalendarMonthGrid(2026, 8);

    expect(grid).toHaveLength(42);
    expect(grid.slice(0, 3)).toEqual([
      { date: { year: 2026, month: 7, day: 30 }, isCurrentMonth: false },
      { date: { year: 2026, month: 7, day: 31 }, isCurrentMonth: false },
      { date: { year: 2026, month: 8, day: 1 }, isCurrentMonth: true },
    ]);
    expect(grid.find((cell) => isSameCalendarDate(cell.date, { year: 2026, month: 8, day: 19 }))).toMatchObject({
      isCurrentMonth: true,
    });
    expect(grid.at(-1)).toEqual({ date: { year: 2026, month: 9, day: 10 }, isCurrentMonth: false });
  });

  it("calculates deterministic ISO weeks", () => {
    expect(getIsoWeekNumber({ year: 2026, month: 8, day: 19 })).toBe(38);
    expect(getIsoWeekNumber({ year: 2021, month: 0, day: 1 })).toBe(53);
  });

  it("handles month and year boundaries without changing the selected-day authority", () => {
    expect(shiftCalendarMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftCalendarMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftCalendarYear({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 1 });
  });

  it("uses leap-year month lengths", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
    expect(getDaysInMonth(2026, 1)).toBe(28);
  });

  it("formats the calendar headings and Sunday-first weekday row from the active locale", () => {
    expect(getLocalizedMonthName("de", 8)).toBe("September");
    expect(getLocalizedWeekdayLabels("de")).toEqual(["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]);
    expect(getLocalizedMonthName("zh-CN", 8)).toBe("九月");
  });
});
