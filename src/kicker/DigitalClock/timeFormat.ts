export type ClockParts = {
  hours: string;
  minutes: string;
  seconds: string;
  date: string;
  weekday: string;
  readableTime: string;
  readableTimeWithSeconds: string;
  readableDate: string;
};

const pad2 = (value: number): string => value.toString().padStart(2, "0");

export const formatTime24 = (date: Date): string => {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export const formatTime24WithSeconds = (date: Date): string => {
  return `${formatTime24(date)}:${pad2(date.getSeconds())}`;
};

export const formatDateDDMMYY = (date: Date, locale = "en"): string => {
  if (locale !== "en") {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
  }

  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = pad2(date.getFullYear() % 100);
  return `${day}/${month}/${year}`;
};

export const formatWeekdayShort = (date: Date, locale = "en"): string => {
  if (locale !== "en") {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekdays[date.getDay()] ?? "";
};

export const getClockParts = (date: Date, locale = "en"): ClockParts => {
  const time = formatTime24(date);
  const timeWithSeconds = formatTime24WithSeconds(date);
  const displayDate = formatDateDDMMYY(date, locale);

  return {
    hours: time.slice(0, 2),
    minutes: time.slice(3, 5),
    seconds: timeWithSeconds.slice(6, 8),
    date: displayDate,
    weekday: formatWeekdayShort(date, locale),
    readableTime: time,
    readableTimeWithSeconds: timeWithSeconds,
    readableDate: displayDate,
  };
};
