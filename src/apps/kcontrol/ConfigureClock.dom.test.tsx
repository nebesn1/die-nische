// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DigitalClock } from "../../kicker/DigitalClock/DigitalClock";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../../preferences/desktopPreferences";
import { ConfigureClock } from "./ConfigureClock";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

function renderClockSettings() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(
    <DesktopPreferencesProvider initialPreferences={DEFAULT_DESKTOP_PREFERENCES}>
      <ConfigureClock />
      <DigitalClock />
    </DesktopPreferencesProvider>,
  ));
}

const checkboxes = () => [...(container?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])];
const button = (label: string) => {
  const match = [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((candidate) => candidate.textContent === label);
  if (!match) throw new Error(`Missing ${label} button.`);
  return match;
};

describe("Configure Clock", () => {
  it("renders the exact Display and Time settings with the accepted defaults", () => {
    renderClockSettings();
    const markup = container?.innerHTML ?? "";

    expect(markup).toContain("Display");
    expect(markup).toContain("Date");
    expect(markup).toContain("Seconds");
    expect(markup).toContain("Day of week");
    expect(markup).toContain("Blinking dots");
    expect(markup).toContain("Frame");
    expect(markup).toContain("Time");
    expect(markup).toContain("LCD look");
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, false, false, true, true, true]);
  });

  it("keeps clock changes local until Apply and preserves independent rendering controls", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
    renderClockSettings();
    const [date, seconds, weekday, blinking, frame, lcd] = checkboxes();

    act(() => seconds.click());
    act(() => weekday.click());
    act(() => blinking.click());
    act(() => frame.click());
    act(() => lcd.click());
    expect(container?.querySelector(".digital-clock__time-face")?.className).not.toContain("--seconds");
    expect(container?.querySelector(".digital-clock__date")?.textContent).toBe("19/09/26");

    act(() => button("Apply").click());
    const timeFace = container?.querySelector(".digital-clock__time-face");
    expect(timeFace?.className).toContain("digital-clock__time-face--seconds");
    expect(timeFace?.className).toContain("digital-clock__time-face--plain");
    expect(timeFace?.className).toContain("digital-clock__time-face--frameless");
    expect(container?.querySelector(".digital-clock__date")?.textContent).toBe("Sat 19/09/26");
    expect(date.checked).toBe(true);
  });

  it("restores the applied clock draft with Reset and Defaults", () => {
    renderClockSettings();
    const [date, seconds] = checkboxes();
    act(() => date.click());
    act(() => seconds.click());
    act(() => button("Reset").click());
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, false, false, true, true, true]);
    act(() => date.click());
    act(() => button("Defaults").click());
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, false, false, true, true, true]);
  });
});
