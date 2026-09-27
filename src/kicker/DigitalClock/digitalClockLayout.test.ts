import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlsCss = readFileSync(new URL("../../theme/controls.css", import.meta.url), "utf8");

const rule = (selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = controlsCss.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
};

describe("DigitalClock frame ownership", () => {
  it("keeps the outer hit box geometry without giving the time and date a shared visible frame", () => {
    const clock = rule(".digital-clock");

    expect(clock).toMatch(/height:\s*38px/);
    expect(clock).toMatch(/min-width:\s*86px/);
    expect(clock).toMatch(/border:\s*1px solid transparent/);
    expect(clock).not.toMatch(/border-color:\s*var\(--kde-border-dark\)/);
    expect(clock).not.toMatch(/box-shadow:/);
  });

  it("assigns the visible bevel to the time face and leaves the date unframed", () => {
    const timeFace = rule(".digital-clock__time-face");
    const date = rule(".digital-clock__date");

    expect(timeFace).toMatch(/border-color:\s*var\(--kde-border-dark\)\s+var\(--kde-border-highlight\)/);
    expect(timeFace).toMatch(/background:\s*var\(--kde-clock-face\)/);
    expect(date).not.toMatch(/border|box-shadow/);
  });

  it("keeps LCD OFF independent from the time-only frame", () => {
    expect(rule(".digital-clock__time-face--plain")).toMatch(/background:\s*transparent/);
    expect(rule(".digital-clock__time-face--plain")).not.toMatch(/border-color/);
  });

  it("reserves a wider stable clock width for seconds without changing panel height", () => {
    expect(rule(".digital-clock")).toMatch(/height:\s*38px/);
    expect(rule(".digital-clock--seconds")).toMatch(/min-width:\s*130px/);
    expect(rule(".digital-clock__time-face--seconds")).toMatch(/width:\s*120px/);
    expect(rule(".digital-clock__time--seconds")).toMatch(/width:\s*114px/);
  });

  it("keeps the visible frame switch independent from the LCD switch", () => {
    expect(rule(".digital-clock__time-face--frameless")).toMatch(/border-color:\s*transparent/);
    expect(rule(".digital-clock__time-face--frameless")).not.toMatch(/background:/);
  });
});
