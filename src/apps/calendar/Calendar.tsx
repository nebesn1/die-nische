import { useEffect, useMemo, useState } from "react";
import { formatDateDDMMYY } from "../../kicker/DigitalClock/timeFormat";
import {
  getCalendarMonthGrid,
  getIsoWeekNumber,
  isSameCalendarDate,
  getLocalizedMonthName,
  getLocalizedWeekdayLabels,
  shiftCalendarMonth,
  shiftCalendarYear,
  toCalendarDate,
  type CalendarDate,
} from "./calendarModel";
import { useI18n } from "../../i18n/useI18n";

const getToday = (): CalendarDate => toCalendarDate(new Date());

export function Calendar() {
  const { locale, t } = useI18n();
  const [today, setToday] = useState(getToday);
  const [selectedDate, setSelectedDate] = useState(getToday);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const current = getToday();
    return { year: current.year, month: current.month };
  });

  useEffect(() => {
    const timerId = window.setInterval(() => setToday(getToday()), 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  const cells = useMemo(
    () => getCalendarMonthGrid(visibleMonth.year, visibleMonth.month),
    [visibleMonth.month, visibleMonth.year],
  );
  const monthName = getLocalizedMonthName(locale, visibleMonth.month);
  const weekdayLabels = useMemo(() => getLocalizedWeekdayLabels(locale), [locale]);
  const selectedAsDate = new Date(selectedDate.year, selectedDate.month, selectedDate.day, 12);
  const selectDate = (date: CalendarDate) => {
    setSelectedDate(date);
    if (date.year !== visibleMonth.year || date.month !== visibleMonth.month) {
      setVisibleMonth({ year: date.year, month: date.month });
    }
  };

  return (
    <main className="calendar" aria-label={t("calendar.title")}>
      <div className="calendar__panel">
        <header className="calendar__header">
          <button type="button" className="calendar__nav-button" aria-label={t("calendar.previousYear")} onClick={() => setVisibleMonth((current) => shiftCalendarYear(current, -1))}>«</button>
          <button type="button" className="calendar__nav-button" aria-label={t("calendar.previousMonth")} onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, -1))}>‹</button>
          <h1 className="calendar__heading">{t("calendar.monthYear", { month: monthName, year: visibleMonth.year })}</h1>
          <button type="button" className="calendar__nav-button" aria-label={t("calendar.nextMonth")} onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, 1))}>›</button>
          <button type="button" className="calendar__nav-button" aria-label={t("calendar.nextYear")} onClick={() => setVisibleMonth((current) => shiftCalendarYear(current, 1))}>»</button>
        </header>
        <div className="calendar__weekday-row" role="row">
          {weekdayLabels.map((label) => <span key={label} role="columnheader">{label}</span>)}
        </div>
        <div className="calendar__grid" role="grid" aria-label={t("calendar.monthYear", { month: monthName, year: visibleMonth.year })}>
          {cells.map((cell) => {
            const selected = isSameCalendarDate(cell.date, selectedDate);
            const isToday = isSameCalendarDate(cell.date, today);
            return (
              <button
                key={`${cell.date.year}-${cell.date.month}-${cell.date.day}`}
                type="button"
                role="gridcell"
                className={`calendar__day${cell.isCurrentMonth ? "" : " is-adjacent"}${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                aria-label={`${cell.date.year}-${String(cell.date.month + 1).padStart(2, "0")}-${String(cell.date.day).padStart(2, "0")}`}
                aria-selected={selected}
                onClick={() => selectDate(cell.date)}
              >
                {cell.date.day}
              </button>
            );
          })}
        </div>
        <footer className="calendar__footer">
          <span>{formatDateDDMMYY(selectedAsDate, locale)}</span>
          <span>{t("calendar.week", { number: String(getIsoWeekNumber(selectedDate)).padStart(2, "0") })}</span>
        </footer>
      </div>
    </main>
  );
}
