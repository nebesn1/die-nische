// @vitest-environment jsdom
import { StrictMode, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWindowManagerState, windowReducer } from "../../window-manager/windowReducer";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import type { DesktopWindow } from "../../window-manager/types";
import { KCalc } from "./KCalc";

type KCalcHarnessProps = {
  readonly windowId: string;
  readonly isActive: boolean;
  readonly focusRequestId: number;
  readonly onRequestClose?: () => void;
  readonly onLaunchApplication?: (appId: string) => void;
};

let container: HTMLDivElement;
let reactRoot: Root;
let nextAnimationFrameId: number;
let animationFrameCallbacks: Map<number, FrameRequestCallback>;
let windowManager: WindowManagerContextValue;

const createWindowManager = (windows: readonly DesktopWindow[] = []): WindowManagerContextValue => ({
  windows,
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 },
  activateWindow: vi.fn(),
  focusWindow: vi.fn(),
  openWindow: vi.fn(),
  moveWindow: vi.fn(),
  resizeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  restoreWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  restoreMaximizedWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  toggleTaskbarWindow: vi.fn(),
  switchDesktop: vi.fn(),
  toggleShowDesktop: vi.fn(),
  moveWindowToDesktop: vi.fn(),
  setWorkArea: vi.fn(),
});

const renderWithWindowManager = (children: ReactNode) => {
  reactRoot.render(
    <WindowManagerContext.Provider value={windowManager}>
      <StrictMode>{children}</StrictMode>
    </WindowManagerContext.Provider>,
  );
};

const renderKCalc = (props: KCalcHarnessProps) => {
  const { onLaunchApplication, ...kcalcProps } = props;
  act(() => {
    renderWithWindowManager(
      <ApplicationLauncherContext.Provider value={{
        launchApplication: (appId) => { onLaunchApplication?.(appId); return "opened"; },
        launchNewApplicationInstance: () => "opened",
      }}>
        <KCalc {...kcalcProps} />
      </ApplicationLauncherContext.Provider>,
    );
  });
};

const flushAnimationFrames = () => {
  act(() => {
    const callbacks = [...animationFrameCallbacks.values()];
    animationFrameCallbacks.clear();
    callbacks.forEach((callback) => callback(0));
  });
};

const getCalculatorRoot = (windowId: string): HTMLDivElement => {
  const calculatorRoot = container.querySelector<HTMLDivElement>(`[data-kcalc-root="true"][data-window-id="${windowId}"]`);

  if (!calculatorRoot) {
    throw new Error(`Missing KCalc root for ${windowId}`);
  }

  return calculatorRoot;
};

const getDisplay = (calculatorRoot: HTMLDivElement): HTMLInputElement => {
  const display = calculatorRoot.querySelector<HTMLInputElement>("[aria-label='Calculator display']");

  if (!display) {
    throw new Error("Missing calculator display");
  }

  return display;
};

const pressKey = (calculatorRoot: HTMLDivElement, key: string) => {
  act(() => {
    calculatorRoot.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
};

const getButton = (calculatorRoot: HTMLDivElement, label: string): HTMLButtonElement => {
  const button = [...calculatorRoot.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label);

  if (!button) {
    throw new Error(`Missing calculator button ${label}`);
  }

  return button;
};

const clickButton = (calculatorRoot: HTMLDivElement, label: string) => {
  act(() => {
    getButton(calculatorRoot, label).click();
  });
};

const getSettingsMenu = (calculatorRoot: HTMLDivElement): HTMLDivElement => {
  const settingsMenu = calculatorRoot.querySelector<HTMLDivElement>("[aria-label='Settings menu']");

  if (!settingsMenu) {
    throw new Error("Missing Settings menu");
  }

  return settingsMenu;
};

const getOptionalPanel = (calculatorRoot: HTMLDivElement, label: string): HTMLElement | null =>
  calculatorRoot.querySelector(`[aria-label='${label}']`);

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  nextAnimationFrameId = 1;
  animationFrameCallbacks = new Map();
  windowManager = createWindowManager();

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const animationFrameId = nextAnimationFrameId;
    nextAnimationFrameId += 1;
    animationFrameCallbacks.set(animationFrameId, callback);
    return animationFrameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((animationFrameId) => {
    animationFrameCallbacks.delete(animationFrameId);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("KCalc DOM focus handoff", () => {
  it("keeps C and AC semantics while wiring the visible sign button through the existing reducer", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    clickButton(calculatorRoot, "5");
    clickButton(calculatorRoot, "±");
    expect(getDisplay(calculatorRoot).value).toBe("-5");
    clickButton(calculatorRoot, "±");
    expect(getDisplay(calculatorRoot).value).toBe("5");

    clickButton(calculatorRoot, "+");
    clickButton(calculatorRoot, "3");
    clickButton(calculatorRoot, "C");
    clickButton(calculatorRoot, "4");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("9");

    clickButton(calculatorRoot, "AC");
    expect(getDisplay(calculatorRoot).value).toBe("0");

    clickButton(calculatorRoot, "Inv");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("INV");
    pressKey(calculatorRoot, "7");
    expect(getDisplay(calculatorRoot).value).toBe("7");
  });

  it("enables only the confirmed Base Scientific and memory commands while keeping deferred controls disabled", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    expect(getButton(calculatorRoot, "Inv").disabled).toBe(false);
    for (const label of ["x·10ʸ", "(", ")"]) {
      expect(getButton(calculatorRoot, label).disabled).toBe(true);
    }
    for (const label of ["Mod", "1/x", "x!", "x²", "√x", "xʸ", "MS", "M+", "%"]) {
      expect(getButton(calculatorRoot, label).disabled).toBe(false);
    }
    expect(getButton(calculatorRoot, "MR").disabled).toBe(true);
    expect(getButton(calculatorRoot, "MC").disabled).toBe(false);

    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "Mod");
    clickButton(calculatorRoot, "5");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("2");

    clickButton(calculatorRoot, "MS");
    expect(getButton(calculatorRoot, "MR").disabled).toBe(false);
    expect(getButton(calculatorRoot, "MC").disabled).toBe(false);
    clickButton(calculatorRoot, "MC");
    expect(getButton(calculatorRoot, "MR").disabled).toBe(true);
    expect(getButton(calculatorRoot, "MC").disabled).toBe(false);
  });

  it("executes descriptor command ids through the same physical Base Scientific and memory slots", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    clickButton(calculatorRoot, "3");
    clickButton(calculatorRoot, "x²");
    expect(getDisplay(calculatorRoot).value).toBe("9");

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "x³");
    expect(getDisplay(calculatorRoot).value).toBe("8");

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "IntDiv");
    clickButton(calculatorRoot, "8");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("0");

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "5");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "M-");
    expect(getButton(calculatorRoot, "MR").disabled).toBe(false);
    clickButton(calculatorRoot, "MR");
    expect(getDisplay(calculatorRoot).value).toBe("-5");
    expect(getButton(calculatorRoot, "M+").disabled).toBe(false);
  });

  it("consumes INV only after the captured secondary command has been dispatched", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "x³");
    expect(getDisplay(calculatorRoot).value).toBe("8");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("NORM");
    expect(getButton(calculatorRoot, "x²")).toBeTruthy();

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "8");
    clickButton(calculatorRoot, "±");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "∛x");
    expect(getDisplay(calculatorRoot).value).toBe("-2");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("NORM");
    expect(getButton(calculatorRoot, "√x")).toBeTruthy();

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "8");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "x1/y");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("NORM");
    expect(calculatorRoot.querySelector("[data-kcalc-command-slot='base-power']")?.getAttribute("data-kcalc-command-id")).toBe("power");
    clickButton(calculatorRoot, "3");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("2");

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "IntDiv");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("NORM");
    expect(calculatorRoot.querySelector("[data-kcalc-command-slot='base-mod']")?.getAttribute("data-kcalc-command-id")).toBe("mod");
    clickButton(calculatorRoot, "8");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("2");

    clickButton(calculatorRoot, "AC");
    clickButton(calculatorRoot, "1");
    clickButton(calculatorRoot, "0");
    clickButton(calculatorRoot, "MS");
    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "M-");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("NORM");
    expect(getButton(calculatorRoot, "M+")).toBeTruthy();
    clickButton(calculatorRoot, "7");
    expect(getDisplay(calculatorRoot).value).toBe("7");
    clickButton(calculatorRoot, "MR");
    expect(getDisplay(calculatorRoot).value).toBe("0");

    clickButton(calculatorRoot, "Inv");
    clickButton(calculatorRoot, "7");
    expect(calculatorRoot.querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("INV");
    expect(getButton(calculatorRoot, "x³")).toBeTruthy();
  });

  it("routes the exact Help order to Runtime About windows without an inline KCalc panel", () => {
    const onRequestClose = vi.fn();
    const onLaunchApplication = vi.fn();
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5, onRequestClose, onLaunchApplication });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    expect(getButton(calculatorRoot, "Edit").disabled).toBe(false);
    expect(getButton(calculatorRoot, "Constants").disabled).toBe(false);
    expect(getButton(calculatorRoot, "Settings").disabled).toBe(false);

    clickButton(calculatorRoot, "File");
    clickButton(calculatorRoot, "Close");
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    clickButton(calculatorRoot, "Help");
    const helpMenu = calculatorRoot.querySelector<HTMLElement>("[aria-label='Help menu']");
    expect([...helpMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []].map((button) => button.textContent)).toEqual(["About KCalc", "About KDE"]);
    clickButton(calculatorRoot, "About KCalc");
    expect(onLaunchApplication).toHaveBeenCalledWith("about-kcalc");
    expect(calculatorRoot.querySelector(".kcalc-about")).toBeNull();
    clickButton(calculatorRoot, "5");
    expect(getDisplay(calculatorRoot).value).toBe("5");

    clickButton(calculatorRoot, "Help");
    clickButton(calculatorRoot, "About KDE");
    expect(onLaunchApplication).toHaveBeenCalledWith("about-kde");
  });

  it("uses a checkable Settings menu to compose optional columns and restore Hide All", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    clickButton(calculatorRoot, "Settings");
    const initialSettingsMenu = getSettingsMenu(calculatorRoot);
    const checkableItems = [...initialSettingsMenu.querySelectorAll<HTMLButtonElement>("[role='menuitemcheckbox']")];
    expect([...initialSettingsMenu.querySelectorAll<HTMLButtonElement>("button")].map((item) => item.textContent)).toEqual([
      "Science/Engineering Buttons",
      "Statistic Buttons",
      "Logic Buttons",
      "Constants Buttons",
      "Show All",
      "Hide All",
      "Configure Shortcuts...",
      "Configure KCalc...",
    ]);
    expect(checkableItems.map((item) => item.textContent)).toEqual([
      "Science/Engineering Buttons",
      "Statistic Buttons",
      "Logic Buttons",
      "Constants Buttons",
    ]);
    expect(checkableItems.map((item) => item.getAttribute("aria-checked"))).toEqual(["false", "false", "false", "false"]);
    expect(getButton(initialSettingsMenu, "Configure Shortcuts...").disabled).toBe(true);
    expect(getButton(initialSettingsMenu, "Configure KCalc...").disabled).toBe(false);

    clickButton(calculatorRoot, "Science/Engineering Buttons");
    expect(getOptionalPanel(calculatorRoot, "Science and engineering buttons")).not.toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Statistic buttons")).toBeNull();
    expect(calculatorRoot.textContent).toContain("Angle");

    clickButton(calculatorRoot, "Settings");
    expect(getSettingsMenu(calculatorRoot).querySelector("[role='menuitemcheckbox']")?.getAttribute("aria-checked")).toBe("true");
    clickButton(calculatorRoot, "Constants Buttons");
    expect(getOptionalPanel(calculatorRoot, "Constant buttons")).not.toBeNull();

    clickButton(calculatorRoot, "Settings");
    clickButton(calculatorRoot, "Show All");
    expect(getOptionalPanel(calculatorRoot, "Statistic buttons")).not.toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Science and engineering buttons")).not.toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Logic operation buttons")).not.toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Hexadecimal digit buttons")).not.toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Constant buttons")).not.toBeNull();
    expect(calculatorRoot.querySelector("[aria-label='Base selector']")).not.toBeNull();
    expect([...getOptionalPanel(calculatorRoot, "Statistic buttons")?.querySelectorAll("button") ?? []].map((button) => button.textContent)).toEqual(["N", "Mea", "σN−1", "Med", "Dat", "CSt"]);
    expect(getOptionalPanel(calculatorRoot, "Statistic buttons")?.querySelector("[aria-label='Sample standard deviation']")?.textContent).toBe("σN−1");
    expect([...getOptionalPanel(calculatorRoot, "Science and engineering buttons")?.querySelectorAll("button") ?? []].map((button) => button.textContent)).toEqual(["Hyp", "Sin", "Cos", "Tan", "Log", "Ln"]);
    expect([...getOptionalPanel(calculatorRoot, "Logic operation buttons")?.querySelectorAll("button") ?? []].map((button) => button.textContent)).toEqual(["AND", "OR", "XOR", "Lsh", "Rsh", "Cmp"]);
    expect([...getOptionalPanel(calculatorRoot, "Hexadecimal digit buttons")?.querySelectorAll("button") ?? []].map((button) => button.textContent)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect([...getOptionalPanel(calculatorRoot, "Constant buttons")?.querySelectorAll("button") ?? []].map((button) => button.textContent)).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
    expect([...calculatorRoot.querySelectorAll("[data-kcalc-base-option]")].map((option) => option.getAttribute("data-kcalc-base-option"))).toEqual(["hex", "dec", "oct", "bin"]);
    expect(calculatorRoot.querySelector("[data-kcalc-base-option='dec']")?.getAttribute("aria-checked")).toBe("true");
    expect(calculatorRoot.querySelector("[aria-label='Angle selector']")?.getAttribute("aria-haspopup")).toBe("menu");

    clickButton(calculatorRoot, "Settings");
    expect([...getSettingsMenu(calculatorRoot).querySelectorAll("[role='menuitemcheckbox']")].map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "true", "true", "true"]);
    expect(getButton(getSettingsMenu(calculatorRoot), "Show All").getAttribute("role")).toBe("menuitem");
    expect(getButton(getSettingsMenu(calculatorRoot), "Hide All").getAttribute("role")).toBe("menuitem");
    clickButton(calculatorRoot, "Hide All");
    expect(getOptionalPanel(calculatorRoot, "Statistic buttons")).toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Science and engineering buttons")).toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Logic operation buttons")).toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Hexadecimal digit buttons")).toBeNull();
    expect(getOptionalPanel(calculatorRoot, "Constant buttons")).toBeNull();
    expect(calculatorRoot.querySelector("[aria-label='Angle selector']")).toBeNull();
    expect(calculatorRoot.querySelector("[aria-label='Base selector']")).toBeNull();

    for (const [setting, panel] of [
      ["Statistic Buttons", "Statistic buttons"],
      ["Logic Buttons", "Logic operation buttons"],
      ["Constants Buttons", "Constant buttons"],
    ] as const) {
      clickButton(calculatorRoot, "Settings");
      clickButton(calculatorRoot, setting);
      expect(getOptionalPanel(calculatorRoot, panel)).not.toBeNull();
      clickButton(calculatorRoot, "Settings");
      clickButton(calculatorRoot, "Hide All");
      expect(getOptionalPanel(calculatorRoot, panel)).toBeNull();
    }
  });

  it("enables confirmed Science and Logic commands while deferred controls remain disabled and preserves a pending calculation through layout changes", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    clickButton(calculatorRoot, "1");
    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "+");
    clickButton(calculatorRoot, "Settings");
    clickButton(calculatorRoot, "Show All");

    [...calculatorRoot.querySelectorAll<HTMLButtonElement>("[aria-label='Science and engineering buttons'] button")]
      .forEach((button) => expect(button.disabled).toBe(false));
    [...calculatorRoot.querySelectorAll<HTMLButtonElement>("[aria-label='Logic operation buttons'] button")]
      .forEach((button) => expect(button.disabled).toBe(false));
    for (const selector of ["[aria-label='Hexadecimal digit buttons'] button"]) {
      [...calculatorRoot.querySelectorAll<HTMLButtonElement>(selector)].forEach((button) => expect(button.disabled).toBe(true));
    }
    [...calculatorRoot.querySelectorAll<HTMLButtonElement>("[aria-label='Constant buttons'] button")]
      .forEach((button) => expect(button.disabled).toBe(false));
    for (const selector of [
      "[data-kcalc-command-slot='statistics-count']",
      "[data-kcalc-command-slot='statistics-mean']",
      "[data-kcalc-command-slot='statistics-sample-standard-deviation']",
      "[data-kcalc-command-slot='statistics-median']",
    ]) {
      expect(calculatorRoot.querySelector<HTMLButtonElement>(selector)?.disabled).toBe(false);
    }
    expect(calculatorRoot.querySelector<HTMLButtonElement>("[data-kcalc-command-slot='statistics-data']")?.disabled).toBe(false);
    expect(calculatorRoot.querySelector<HTMLButtonElement>("[data-kcalc-command-slot='statistics-clear']")?.disabled).toBe(false);

    clickButton(calculatorRoot, "3");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("15");
  });

  it("composes optional columns before the core numeric area without duplicating base controls", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();
    const getModuleOrder = () => [...calculatorRoot.querySelectorAll<HTMLElement>("[data-kcalc-layout-module]")]
      .map((module) => module.dataset.kcalcLayoutModule);

    expect(getModuleOrder()).toEqual(["base-scientific", "core-calculator"]);

    clickButton(calculatorRoot, "Settings");
    clickButton(calculatorRoot, "Logic Buttons");
    expect(getModuleOrder()).toEqual(["logic-operations", "base-scientific", "logic-digits", "core-calculator"]);

    clickButton(calculatorRoot, "Settings");
    clickButton(calculatorRoot, "Constants Buttons");
    expect(getModuleOrder()).toEqual(["logic-operations", "base-scientific", "logic-digits", "constants", "core-calculator"]);

    clickButton(calculatorRoot, "Settings");
    clickButton(calculatorRoot, "Show All");
    expect(getModuleOrder()).toEqual([
      "statistics",
      "science",
      "logic-operations",
      "base-scientific",
      "logic-digits",
      "constants",
      "core-calculator",
    ]);

    for (const label of ["Mod", "1/x", "x!", "x²", "√x", "xʸ"]) {
      expect([...calculatorRoot.querySelectorAll("button")].filter((button) => button.textContent === label)).toHaveLength(1);
    }
    expect([...calculatorRoot.querySelectorAll("[data-kcalc-layout-module='core-calculator'] button")]
      .map((button) => button.textContent)).toContain("C");
    expect([...calculatorRoot.querySelectorAll("[data-kcalc-layout-module='core-calculator'] button")]
      .map((button) => button.textContent)).toContain("AC");
  });

  it("uses the application natural-size path for a fixed KCalc without resetting calculation state", () => {
    windowManager = createWindowManager([{
      id: "app:kcalc",
      appId: "kcalc",
      title: "KCalc",
      iconId: "kcalc",
      desktopId: 1,
      bounds: { x: 330, y: 105, width: 273, height: 282 },
      zIndex: 1,
      isActive: true,
      state: "normal",
      isDraggable: true,
      minimumWidth: 273,
      minimumHeight: 282,
      isResizable: false,
    }]);
    windowManager.fitWindowToContent = vi.fn();
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    clickButton(calculatorRoot, "1");
    clickButton(calculatorRoot, "2");
    clickButton(calculatorRoot, "+");
    clickButton(calculatorRoot, "Settings");
    clickButton(calculatorRoot, "Logic Buttons");

    expect(windowManager.fitWindowToContent).toHaveBeenLastCalledWith("app:kcalc", {
      x: 330,
      y: 105,
      width: 349,
      height: 282,
    });
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
    clickButton(calculatorRoot, "3");
    clickButton(calculatorRoot, "=");
    expect(getDisplay(calculatorRoot).value).toBe("15");
  });

  it("keeps optional layouts and keyboard ownership isolated between KCalc instances", () => {
    act(() => {
      renderWithWindowManager(
        <>
          <KCalc windowId="app:kcalc" isActive={true} focusRequestId={5} />
          <KCalc windowId="app:kcalc::2" isActive={false} focusRequestId={0} />
          <KCalc windowId="app:kcalc::3" isActive={false} focusRequestId={0} />
        </>,
      );
    });
    const first = getCalculatorRoot("app:kcalc");
    const second = getCalculatorRoot("app:kcalc::2");
    const third = getCalculatorRoot("app:kcalc::3");
    flushAnimationFrames();

    clickButton(first, "Settings");
    clickButton(first, "Science/Engineering Buttons");
    clickButton(first, "Settings");
    clickButton(first, "Logic Buttons");
    clickButton(second, "Settings");
    clickButton(second, "Constants Buttons");

    expect(getOptionalPanel(first, "Science and engineering buttons")).not.toBeNull();
    expect(getOptionalPanel(first, "Logic operation buttons")).not.toBeNull();
    expect(getOptionalPanel(first, "Constant buttons")).toBeNull();
    expect(getOptionalPanel(second, "Constant buttons")).not.toBeNull();
    expect(getOptionalPanel(second, "Science and engineering buttons")).toBeNull();
    expect(getOptionalPanel(third, "Constant buttons")).toBeNull();

    pressKey(first, "7");
    expect(getDisplay(first).value).toBe("7");
    expect(getDisplay(second).value).toBe("0");
  });

  it("consumes an active request already present at StrictMode mount and accepts keyboard input", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");

    flushAnimationFrames();

    expect(document.activeElement).toBe(calculatorRoot);
    pressKey(calculatorRoot, "1");
    pressKey(calculatorRoot, "2");
    pressKey(calculatorRoot, "3");
    expect(getDisplay(calculatorRoot).value).toBe("123");
  });

  it("focuses when a request arrives after an inactive mount", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: false, focusRequestId: 0 });
    expect(animationFrameCallbacks.size).toBe(0);

    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 6 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    expect(document.activeElement).toBe(calculatorRoot);
  });

  it("focuses the exact KCalc root after the WindowManager restores it", () => {
    const workArea = { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 };
    const initialState = createWindowManagerState([{
      id: "app:kcalc",
      appId: "kcalc",
      baseTitle: "KCalc",
      title: "KCalc",
      iconId: "kcalc",
      desktopId: 1,
      bounds: { x: 330, y: 105, width: 310, height: 300 },
      zIndex: 1,
      isActive: true,
      focusRequestId: 5,
      state: "normal",
      isDraggable: true,
      minimumWidth: 292,
      minimumHeight: 270,
      isResizable: true,
    }], workArea);
    const minimized = windowReducer(initialState, { type: "minimizeWindow", id: "app:kcalc" });
    const restored = windowReducer(minimized, { type: "restoreWindow", id: "app:kcalc" });
    const restoredWindow = restored.windows[0];

    if (!restoredWindow) {
      throw new Error("Expected restored KCalc window");
    }

    renderKCalc({
      windowId: restoredWindow.id,
      isActive: restoredWindow.isActive,
      focusRequestId: restoredWindow.focusRequestId ?? 0,
    });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    flushAnimationFrames();

    expect(restoredWindow.focusRequestId).toBeGreaterThan(
      minimized.windows[0]?.focusRequestId ?? 0,
    );
    expect(document.activeElement).toBe(calculatorRoot);
    pressKey(calculatorRoot, "2");
    expect(getDisplay(calculatorRoot).value).toBe("2");
  });

  it("focuses the exact fallback KCalc after its active sibling is minimized", () => {
    const workArea = { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 };
    const state = createWindowManagerState([
      {
        id: "app:kcalc",
        appId: "kcalc",
        baseTitle: "KCalc",
        title: "KCalc",
        iconId: "kcalc",
        desktopId: 1,
        bounds: { x: 330, y: 105, width: 310, height: 300 },
        zIndex: 2,
        isActive: true,
        focusRequestId: 1,
        state: "normal",
        isDraggable: true,
        minimumWidth: 292,
        minimumHeight: 270,
        isResizable: true,
      },
      {
        id: "app:kcalc::2",
        appId: "kcalc",
        baseTitle: "KCalc",
        title: "KCalc",
        iconId: "kcalc",
        desktopId: 1,
        bounds: { x: 354, y: 129, width: 310, height: 300 },
        zIndex: 1,
        isActive: false,
        focusRequestId: 0,
        state: "normal",
        isDraggable: true,
        minimumWidth: 292,
        minimumHeight: 270,
        isResizable: true,
      },
    ], workArea);
    const minimized = windowReducer(state, { type: "minimizeWindow", id: "app:kcalc" });
    const first = minimized.windows.find((desktopWindow) => desktopWindow.id === "app:kcalc");
    const second = minimized.windows.find((desktopWindow) => desktopWindow.id === "app:kcalc::2");

    if (!first || !second) {
      throw new Error("Expected both KCalc windows");
    }

    act(() => {
      renderWithWindowManager(
        <>
          <KCalc windowId={first.id} isActive={first.isActive} focusRequestId={first.focusRequestId ?? 0} />
          <KCalc windowId={second.id} isActive={second.isActive} focusRequestId={second.focusRequestId ?? 0} />
        </>,
      );
    });
    const fallbackRoot = getCalculatorRoot(second.id);
    flushAnimationFrames();

    expect(second.isActive).toBe(true);
    expect(second.focusRequestId).toBeGreaterThan(0);
    expect(document.activeElement).toBe(fallbackRoot);
    pressKey(fallbackRoot, "8");
    expect(getDisplay(fallbackRoot).value).toBe("8");
    expect(getDisplay(getCalculatorRoot(first.id)).value).toBe("0");
  });

  it("does not refocus for calculator state updates or a duplicate request", () => {
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    const calculatorRoot = getCalculatorRoot("app:kcalc");
    const focus = vi.spyOn(calculatorRoot, "focus");

    flushAnimationFrames();
    pressKey(calculatorRoot, "1");
    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 5 });
    flushAnimationFrames();

    expect(focus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(calculatorRoot);

    renderKCalc({ windowId: "app:kcalc", isActive: true, focusRequestId: 6 });
    flushAnimationFrames();

    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("routes focus and keyboard input to the exact active KCalc instance", () => {
    act(() => {
      renderWithWindowManager(
        <>
          <KCalc windowId="app:kcalc" isActive={false} focusRequestId={5} />
          <KCalc windowId="app:kcalc::2" isActive={true} focusRequestId={8} />
        </>,
      );
    });
    const first = getCalculatorRoot("app:kcalc");
    const second = getCalculatorRoot("app:kcalc::2");
    flushAnimationFrames();

    expect(document.activeElement).toBe(second);
    pressKey(second, "4");
    expect(getDisplay(first).value).toBe("0");
    expect(getDisplay(second).value).toBe("4");

    act(() => {
      renderWithWindowManager(
        <>
          <KCalc windowId="app:kcalc" isActive={true} focusRequestId={9} />
          <KCalc windowId="app:kcalc::2" isActive={false} focusRequestId={8} />
        </>,
      );
    });
    flushAnimationFrames();

    expect(document.activeElement).toBe(first);
    pressKey(first, "7");
    expect(getDisplay(first).value).toBe("7");
    expect(getDisplay(second).value).toBe("4");
  });
});
