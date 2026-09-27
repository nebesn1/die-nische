// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./Calendar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const renderCalendar = () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Calendar />));
};

const button = (label: string): HTMLButtonElement => {
  const found = [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((element) => element.getAttribute("aria-label") === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe("Calendar DOM", () => {
  it("renders the September 2026 monthly grid, selection, and ISO footer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
    renderCalendar();

    expect(container?.querySelector(".calendar__heading")?.textContent).toBe("September 2026");
    expect([...container?.querySelectorAll(".calendar__weekday-row span") ?? []].map((element) => element.textContent))
      .toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(container?.querySelector('[aria-label="2026-09-19"]')?.getAttribute("aria-selected")).toBe("true");
    expect(container?.querySelector('[aria-label="2026-08-30"]')?.classList.contains("is-adjacent")).toBe(true);
    expect(container?.querySelector(".calendar__footer")?.textContent).toContain("19/09/26");
    expect(container?.querySelector(".calendar__footer")?.textContent).toContain("Week 38");
  });

  it("navigates through controls and lets an adjacent-month date navigate and select", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
    renderCalendar();

    act(() => button("Next month").click());
    expect(container?.querySelector(".calendar__heading")?.textContent).toBe("October 2026");
    act(() => button("Previous year").click());
    expect(container?.querySelector(".calendar__heading")?.textContent).toBe("October 2025");
    act(() => button("Next year").click());
    act(() => button("Previous month").click());
    expect(container?.querySelector(".calendar__heading")?.textContent).toBe("September 2026");

    act(() => button("2026-08-31").click());
    expect(container?.querySelector(".calendar__heading")?.textContent).toBe("August 2026");
    expect(container?.querySelector('[aria-label="2026-08-31"]')?.getAttribute("aria-selected")).toBe("true");
  });
});
