export type LocalDateTimeFormatOptions = {
  readonly timeZone?: string;
  readonly locale?: string;
};

const getPart = (parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  parts.find((part) => part.type === type)?.value ?? "";

/** Formats an ISO instant in the host timezone unless an explicit test override is supplied. */
export function formatTimestampForLocalDisplay(
  isoTimestamp: string,
  options: LocalDateTimeFormatOptions = {},
): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;

  const parts = new Intl.DateTimeFormat(options.locale ?? "en-CA", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")} ${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
}
