import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatTimestampForLocalDisplay } from "./formatLocalDateTime";

describe("local timestamp formatting", () => {
  it("formats UTC instants in an explicit timezone without changing the stored instant", () => {
    const instant = "2026-08-11T14:30:00.000Z";

    expect(formatTimestampForLocalDisplay(instant, { timeZone: "UTC" })).toBe("2026-08-11 14:30");
    expect(formatTimestampForLocalDisplay(instant, { timeZone: "Asia/Singapore" })).toBe("2026-08-11 22:30");
    expect(instant).toBe("2026-08-11T14:30:00.000Z");
  });

  it("uses timezone rules for date rollover and negative-offset daylight saving time", () => {
    expect(formatTimestampForLocalDisplay("2026-08-11T23:30:00.000Z", { timeZone: "Pacific/Auckland" })).toBe("2026-08-12 11:30");
    expect(formatTimestampForLocalDisplay("2026-08-11T14:30:00.000Z", { timeZone: "America/New_York" })).toBe("2026-08-11 10:30");
  });

  it("keeps invalid timestamps controlled and does not hardcode a fixed offset", () => {
    const source = readFileSync(new URL("./formatLocalDateTime.ts", import.meta.url), "utf8");

    expect(formatTimestampForLocalDisplay("not-a-date")).toBe("not-a-date");
    expect(source).not.toContain("Asia/Singapore");
    expect(source).not.toContain("getTimezoneOffset");
    expect(source).not.toContain("getUTC");
  });
});
