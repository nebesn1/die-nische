// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationRuntimeProvider } from "../../application-runtime/ApplicationRuntimeProvider";
import { useApplicationUsage } from "../../application-runtime/ApplicationUsageContext";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { WindowManagerProvider } from "../../window-manager/WindowManagerProvider";
import { useWindowManager } from "../../window-manager/useWindowManager";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { CALENDAR_WINDOW_SIZE } from "../../apps/calendar/calendarWindow";
import { Taskbar } from "../Taskbar";
import { DigitalClock } from "./DigitalClock";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function Probe() {
  const { closeWindow, moveWindow, switchDesktop, windows } = useWindowManager();
  const { launchUserApplication } = useApplicationLauncher();
  const usage = useApplicationUsage();
  const calendar = windows.find((desktopWindow) => desktopWindow.appId === "calendar");
  return (
    <>
      <output data-calendar={calendar ? JSON.stringify(calendar) : ""} data-windows={JSON.stringify(windows)} data-usage={JSON.stringify(usage.recordsByAppId)} />
      <button type="button" onClick={() => calendar && moveWindow(calendar.id, 42, 55)}>Move Calendar</button>
      <button type="button" onClick={() => calendar && closeWindow(calendar.id)}>Close Calendar</button>
      <button type="button" onClick={() => switchDesktop(5)}>Desktop Five</button>
      <button type="button" onClick={() => launchUserApplication?.("kcalc")}>Launch KCalc</button>
    </>
  );
}

function renderClock(desktopCount = 4) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <DesktopPreferencesProvider>
        <WindowManagerProvider initialWindows={[]} desktopCount={desktopCount}>
          <ApplicationRuntimeProvider>
            <DigitalClock />
            <Taskbar />
            <Probe />
          </ApplicationRuntimeProvider>
        </WindowManagerProvider>
      </DesktopPreferencesProvider>,
    );
  });
  const clock = container.querySelector<HTMLElement>(".digital-clock");
  if (!clock) throw new Error("Clock missing");
  Object.defineProperty(clock, "getBoundingClientRect", {
    value: () => ({ right: 760, top: 550 }),
  });
  return clock;
}

const getCalendar = () => {
  const raw = container?.querySelector("output[data-calendar]")?.getAttribute("data-calendar");
  return raw ? JSON.parse(raw) as { id: string; bounds: { x: number; y: number }; desktopId: number; isMinimizable: boolean; alwaysOnTop: boolean } : null;
};

const getWindows = () => {
  const raw = container?.querySelector("output[data-calendar]")?.getAttribute("data-windows");
  return raw ? JSON.parse(raw) as Array<{ appId: string; zIndex: number }> : [];
};

const clickButton = (label: string) => {
  const button = [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Missing ${label}`);
  act(() => button.click());
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("Clock Calendar launch", () => {
  it("opens one non-minimizable, always-on-top Calendar at the live Clock anchor and excludes it from usage", () => {
    const clock = renderClock();
    act(() => clock.click());

    expect(getCalendar()).toMatchObject({
      id: "app:calendar",
      bounds: { x: 760 - CALENDAR_WINDOW_SIZE.width, y: 550 - CALENDAR_WINDOW_SIZE.height },
      desktopId: 1,
      isMinimizable: false,
      alwaysOnTop: true,
    });
    expect(container?.querySelector("output[data-usage]")?.getAttribute("data-usage")).toBe("{}");
    expect(container?.querySelector('[data-window-id="app:calendar"]')?.textContent).toContain("Calendar");

    const timeFace = container?.querySelector<HTMLElement>(".digital-clock__time-face");
    const date = container?.querySelector<HTMLElement>(".digital-clock__date");
    act(() => timeFace?.click());
    expect(getCalendar()?.id).toBe("app:calendar");
    act(() => date?.click());
    expect(getCalendar()?.id).toBe("app:calendar");

    clickButton("Launch KCalc");
    const calendarWindow = getWindows().find((desktopWindow) => desktopWindow.appId === "calendar");
    const kcalcWindow = getWindows().find((desktopWindow) => desktopWindow.appId === "kcalc");
    expect(calendarWindow?.zIndex).toBeGreaterThan(kcalcWindow?.zIndex ?? 0);

    act(() => clock.click());
    expect(getCalendar()?.id).toBe("app:calendar");

    clickButton("Move Calendar");
    act(() => clock.click());
    expect(getCalendar()?.bounds).toMatchObject({ x: 42, y: 55 });

    clickButton("Close Calendar");
    expect(getCalendar()).toBeNull();
    expect(container?.querySelector('[data-window-id="app:calendar"]')).toBeNull();
    act(() => clock.click());
    expect(getCalendar()?.bounds).toMatchObject({
      x: 760 - CALENDAR_WINDOW_SIZE.width,
      y: 550 - CALENDAR_WINDOW_SIZE.height,
    });
  });

  it("assigns a newly opened Calendar to the current dynamic desktop", () => {
    const clock = renderClock(5);
    clickButton("Desktop Five");
    act(() => clock.click());
    expect(getCalendar()?.desktopId).toBe(5);
  });
});
