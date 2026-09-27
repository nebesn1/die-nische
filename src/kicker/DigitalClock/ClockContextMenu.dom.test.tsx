// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { WindowManagerProvider } from "../../window-manager/WindowManagerProvider";
import { DigitalClock } from "./DigitalClock";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("DigitalClock context interaction", () => {
  it("opens Configure Clock from a whole-clock right click without launching Calendar", () => {
    const launch = vi.fn(() => "opened" as const);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <DesktopPreferencesProvider>
        <WindowManagerProvider initialWindows={[]}>
          <ApplicationLauncherContext.Provider value={{ launchApplication: launch, launchNewApplicationInstance: launch }}>
            <DigitalClock />
          </ApplicationLauncherContext.Provider>
        </WindowManagerProvider>
      </DesktopPreferencesProvider>,
    ));

    const clock = container.querySelector<HTMLElement>(".digital-clock");
    if (!clock) throw new Error("Clock missing");
    Object.defineProperty(clock, "getBoundingClientRect", {
      value: () => ({ left: 700, right: 790, top: 550, bottom: 588, width: 90, height: 38 }),
    });

    const contextMenuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 760, clientY: 580 });
    act(() => clock.dispatchEvent(contextMenuEvent));
    expect(contextMenuEvent.defaultPrevented).toBe(true);
    expect(container.querySelector(".clock-context-menu-panel")).not.toBeNull();
    expect(container.querySelector('[data-window-id="app:calendar"]')).toBeNull();

    const panel = container.querySelector<HTMLElement>(".clock-context-menu-panel");
    if (!panel) throw new Error("Clock context menu missing");
    expect(panel.querySelectorAll(".k-menu-item.is-active")).toHaveLength(0);
    expect(container.querySelector(".clock-context-menu-popup")?.classList.contains("k-menu-popup--context")).toBe(true);

    const configureButton = container.querySelector<HTMLButtonElement>('[data-menu-item-id="clock-configure"]');
    expect(configureButton).not.toBeNull();
    act(() => configureButton?.click());

    expect(container.querySelector(".clock-context-menu-panel")).toBeNull();
    expect(launch).toHaveBeenCalledWith("configure-clock");
    expect(launch).not.toHaveBeenCalledWith("calendar");
  });

  it("selects Configure Clock only after keyboard navigation or pointer hover", () => {
    const launch = vi.fn(() => "opened" as const);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <DesktopPreferencesProvider>
        <WindowManagerProvider initialWindows={[] }>
          <ApplicationLauncherContext.Provider value={{ launchApplication: launch, launchNewApplicationInstance: launch }}>
            <DigitalClock />
          </ApplicationLauncherContext.Provider>
        </WindowManagerProvider>
      </DesktopPreferencesProvider>,
    ));

    const clock = container.querySelector<HTMLElement>(".digital-clock");
    if (!clock) throw new Error("Clock missing");
    const contextMenuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 760, clientY: 580 });
    act(() => clock.dispatchEvent(contextMenuEvent));

    const panel = container.querySelector<HTMLElement>(".clock-context-menu-panel");
    if (!panel) throw new Error("Clock context menu missing");
    const configureButton = panel.querySelector<HTMLButtonElement>('[data-menu-item-id="clock-configure"]');
    if (!configureButton) throw new Error("Configure Clock item missing");

    act(() => panel.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
    expect(launch).not.toHaveBeenCalled();
    act(() => panel.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(configureButton.classList.contains("is-active")).toBe(true);

  });
});
