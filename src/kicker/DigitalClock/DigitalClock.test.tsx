import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DigitalClock } from "./DigitalClock";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../../preferences/desktopPreferences";

describe("DigitalClock structure", () => {
  it("renders separate time face and date areas", () => {
    const markup = renderToStaticMarkup(<DigitalClock />);

    expect(markup).toContain("class=\"digital-clock\"");
    expect(markup).toContain("class=\"digital-clock__time-face\"");
    expect(markup).toContain("class=\"digital-clock__time\"");
    expect(markup).toContain("class=\"digital-clock__date\"");
  });

  it("keeps the time element dateTime and accessible label", () => {
    const markup = renderToStaticMarkup(<DigitalClock />);

    expect(markup).toContain("dateTime=\"");
    expect(markup).toContain("role=\"button\"");
    expect(markup).toContain("tabindex=\"0\"");
    expect(markup).toContain("aria-label=\"Open Calendar. Current time ");
    expect(markup).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });

  it("continues rendering SVG segment polygons", () => {
    const markup = renderToStaticMarkup(<DigitalClock />);

    expect(markup).toContain("data-segment=\"a\"");
    expect(markup).toContain("data-segment=\"g\"");
    expect(markup).toContain("data-segment=\"dot\"");
  });

  it("groups hours, separator, and minutes with only inter-group spacing widened", () => {
    const markup = renderToStaticMarkup(<DigitalClock />);

    expect(markup).toContain('data-clock-group="hours"');
    expect(markup).toContain('data-clock-group="separator"');
    expect(markup).toContain('data-clock-group="minutes"');
    expect(markup).toContain('viewBox="0 0 128 52"');
    expect(markup).toContain("translate(26 0)");
    expect(markup).toContain("translate(70 0)");
    expect(markup).toContain("translate(96 0)");
  });

  it("can hide only the separate date while keeping the clock face", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider initialPreferences={{ ...DEFAULT_DESKTOP_PREFERENCES, showClockDate: false }}>
        <DigitalClock />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("class=\"digital-clock__time-face\"");
    expect(markup).not.toContain("class=\"digital-clock__date\"");
  });

  it("can remove only the LCD face treatment while keeping the time and date structure", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider initialPreferences={{ ...DEFAULT_DESKTOP_PREFERENCES, lcdClockLook: false }}>
        <DigitalClock />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("digital-clock__time-face digital-clock__time-face--plain");
    expect(markup).toContain('data-lcd-look="false"');
    expect(markup).toContain("class=\"digital-clock__date\"");
  });

  it("renders seconds as a wider fixed SVG mode and keeps the second separator static", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider initialPreferences={{ ...DEFAULT_DESKTOP_PREFERENCES, showSeconds: true }}>
        <DigitalClock />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("digital-clock__time-face digital-clock__time-face--seconds");
    expect(markup).toContain('viewBox="0 0 198 52"');
    expect(markup).toContain('data-clock-group="seconds-separator"');
    expect(markup).toContain('data-clock-group="seconds"');
  });

  it("keeps weekday/date and frame independent from LCD look", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider initialPreferences={{ ...DEFAULT_DESKTOP_PREFERENCES, showClockDate: false, showDayOfWeek: true, lcdClockLook: false, showClockFrame: false }}>
        <DigitalClock />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("digital-clock__time-face--plain");
    expect(markup).toContain("digital-clock__time-face--frameless");
    expect(markup).toContain("digital-clock__date");
    expect(markup).not.toContain("digital-clock__date\">31/07/26");
  });
});
