// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { KMenu } from "../kicker/k-menu/KMenu";
import { WindowManagerProvider } from "../window-manager/WindowManagerProvider";
import { ApplicationRuntimeProvider } from "./ApplicationRuntimeProvider";
import { useApplicationUsage } from "./ApplicationUsageContext";
import { useApplicationLauncher } from "./useApplicationLauncher";
import { useWindowManager } from "../window-manager/useWindowManager";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

function RuntimeProbe() {
  const usage = useApplicationUsage();
  const {
    launchApplication,
    launchNewUserApplicationInstance,
    launchUserApplication,
  } = useApplicationLauncher();
  const { windows } = useWindowManager();

  return (
    <>
      <output data-usage={JSON.stringify(usage.recordsByAppId)} />
      <output data-window-count={windows.length} />
      <button type="button" onClick={() => launchApplication("kcalc")}>System KCalc</button>
      <button type="button" onClick={() => launchUserApplication?.("kcontrol")}>User Control Center</button>
      <button type="button" onClick={() => launchNewUserApplicationInstance?.("kwrite")}>User KWrite</button>
    </>
  );
}

function renderRuntime(children: React.ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  act(() => {
    reactRoot?.render(
      <WindowManagerProvider initialWindows={[]}>
        <ApplicationRuntimeProvider>{children}</ApplicationRuntimeProvider>
      </WindowManagerProvider>,
    );
  });
}

function button(label: string): HTMLButtonElement {
  const element = [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((candidate) => candidate.textContent === label || candidate.getAttribute("aria-label") === label);
  if (!element) throw new Error(`Missing button ${label}`);
  return element;
}

function usage(): Record<string, { count: number }> {
  const raw = container?.querySelector("output[data-usage]")?.getAttribute("data-usage");
  if (!raw) throw new Error("Usage output missing.");
  return JSON.parse(raw) as Record<string, { count: number }>;
}

afterEach(() => {
  act(() => reactRoot?.unmount());
  container?.remove();
  reactRoot = null;
  container = null;
});

describe("Application Runtime Most Used usage", () => {
  it("records only explicit user launches, including singleton refocus and multi-instance aggregation", () => {
    renderRuntime(<RuntimeProbe />);

    act(() => button("System KCalc").click());
    expect(usage()).toEqual({});

    act(() => button("User Control Center").click());
    act(() => button("User Control Center").click());
    expect(usage().kcontrol.count).toBe(2);
    expect(container?.querySelector("output[data-window-count]")?.getAttribute("data-window-count")).toBe("2");

    act(() => button("User KWrite").click());
    act(() => button("User KWrite").click());
    act(() => button("User KWrite").click());
    expect(usage().kwrite.count).toBe(3);
    expect(container?.querySelector("output[data-window-count]")?.getAttribute("data-window-count")).toBe("5");
  });

  it("keeps K Menu empty initially, then records category and Most Used row launches exactly once", () => {
    renderRuntime(<><RuntimeProbe /><KMenu /></>);

    act(() => button("Open K menu").click());
    expect(container?.querySelector('[data-menu-section-id="section-most-used"]')?.nextElementSibling?.getAttribute("data-menu-section-id"))
      .toBe("section-all-applications");

    act(() => button("Editors").click());
    act(() => button("Text Editor (KWrite)").click());
    expect(usage().kwrite.count).toBe(1);

    act(() => button("Open K menu").click());
    const mostUsed = container?.querySelector<HTMLButtonElement>('[data-menu-item-id="most-used-kwrite"]');
    expect(mostUsed?.textContent).toContain("Text Editor (KWrite)");
    act(() => mostUsed?.click());
    expect(usage().kwrite.count).toBe(2);
    expect(container?.querySelector('[data-menu-item-id="most-used-kwrite"]')).toBeNull();
  });

  it("resets usage when a fresh runtime is mounted", () => {
    renderRuntime(<RuntimeProbe />);
    act(() => button("User KWrite").click());
    expect(usage().kwrite.count).toBe(1);

    act(() => reactRoot?.unmount());
    container?.remove();
    reactRoot = null;
    container = null;

    renderRuntime(<RuntimeProbe />);
    expect(usage()).toEqual({});
  });
});
