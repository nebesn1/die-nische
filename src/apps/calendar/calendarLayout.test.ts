import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CALENDAR_WINDOW_SIZE } from "./calendarWindow";

const calendarCss = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

const rule = (selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...calendarCss.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`, "gs"))];
  const match = matches.at(-1);
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
};

describe("Calendar responsive layout contract", () => {
  it("keeps the default compact window size as the initial layout contract", () => {
    expect(calendarCss).toContain(".calendar {");
    expect(CALENDAR_WINDOW_SIZE).toEqual({ width: 304, height: 218 });
  });

  it("makes the Calendar client and panel fill the available client area", () => {
    expect(rule(".calendar")).toMatch(/flex-direction:\s*column/);
    expect(rule(".calendar")).toMatch(/align-items:\s*stretch/);
    expect(rule(".calendar__panel")).toMatch(/width:\s*100%/);
    expect(rule(".calendar__panel")).toMatch(/flex:\s*1 1 auto/);
    expect(rule(".calendar__panel")).toMatch(/flex-direction:\s*column/);
  });

  it("keeps the weekday header at seven equal columns", () => {
    expect(rule(".calendar__weekday-row,\n.calendar__grid")).toMatch(/grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/);
  });

  it("makes the six date rows the primary responsive expansion area", () => {
    const grid = rule(".calendar__grid");

    expect(grid).toMatch(/flex:\s*1 1 auto/);
    expect(grid).toMatch(/grid-template-rows:\s*repeat\(6, minmax\(0, 1fr\)\)/);
    expect(rule(".calendar__day")).toMatch(/min-height:\s*19px/);
    expect(rule(".calendar__day")).not.toMatch(/(?<!min-)height:\s*19px/);
  });

  it("keeps navigation and footer outside the expanding grid", () => {
    expect(rule(".calendar__header")).toMatch(/flex:\s*0 0 auto/);
    expect(rule(".calendar__weekday-row")).toMatch(/flex:\s*0 0 auto/);
    expect(rule(".calendar__footer")).toMatch(/flex:\s*0 0 auto/);
  });

  it("uses normal flow for large, maximized, restored, and compact sizes", () => {
    expect(rule(".calendar")).not.toMatch(/position:\s*absolute/);
    expect(rule(".calendar__panel")).not.toMatch(/position:\s*absolute/);
    expect(rule(".calendar")).not.toMatch(/justify-content:\s*flex-end/);
    expect(rule(".calendar")).not.toMatch(/align-items:\s*flex-start/);
  });

  it("lets cells stretch without changing their compact typography", () => {
    const day = rule(".calendar__day");

    expect(day).toMatch(/display:\s*grid/);
    expect(day).toMatch(/place-items:\s*center/);
    expect(day).toMatch(/font-size:\s*11px/);
    expect(day).toMatch(/line-height:\s*17px/);
  });
});
