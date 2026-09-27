export type CalendarDate = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

export type CalendarMonthCell = Readonly<{
  date: CalendarDate;
  isCurrentMonth: boolean;
}>;

export const WEEKDAY_LABELS = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

export const MONTH_NAMES = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

export function getLocalizedMonthName(locale: string, month: number): string {
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1)));
}

export function getLocalizedWeekdayLabels(locale: string): readonly string[] {
  return Object.freeze(Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + day)))));
}

const createLocalDate = ({ year, month, day }: CalendarDate): Date => new Date(year, month, day, 12);

export const toCalendarDate = (date: Date): CalendarDate => ({
  year: date.getFullYear(),
  month: date.getMonth(),
  day: date.getDate(),
});

export const isSameCalendarDate = (left: CalendarDate, right: CalendarDate): boolean =>
  left.year === right.year && left.month === right.month && left.day === right.day;

export const getDaysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

export const shiftCalendarMonth = ({ year, month }: Pick<CalendarDate, "year" | "month">, offset: number): Pick<CalendarDate, "year" | "month"> => {
  const shifted = new Date(year, month + offset, 1, 12);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
};

export const shiftCalendarYear = ({ year, month }: Pick<CalendarDate, "year" | "month">, offset: number): Pick<CalendarDate, "year" | "month"> => ({
  year: year + offset,
  month,
});

export function getCalendarMonthGrid(year: number, month: number): readonly CalendarMonthCell[] {
  const firstWeekday = createLocalDate({ year, month, day: 1 }).getDay();
  const firstCell = new Date(year, month, 1 - firstWeekday, 12);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index, 12);
    const cellDate = toCalendarDate(date);
    return { date: cellDate, isCurrentMonth: cellDate.month === month && cellDate.year === year };
  });
}

/** ISO-8601 week number, independent of browser locale. */
export function getIsoWeekNumber(calendarDate: CalendarDate): number {
  const date = createLocalDate(calendarDate);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const isoDay = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDay);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
