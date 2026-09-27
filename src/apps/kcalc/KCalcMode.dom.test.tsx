// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupLayer";
import type { DesktopWindow } from "../../window-manager/types";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KCalc } from "./KCalc";
import { KCalcConstantsProvider } from "./KCalcConstantsContext";
import { createDefaultKCalcConstantRegistry } from "./kcalcConstants";

let container: HTMLDivElement;
let reactRoot: Root;
let windowManager: WindowManagerContextValue;

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  width,
  height,
  top,
  right: left + width,
  bottom: top + height,
  left,
  toJSON: () => ({}),
}) as DOMRect;

const createDesktopWindow = (id: string, isActive: boolean): DesktopWindow => ({
  id,
  appId: "kcalc",
  title: id === "app:kcalc" ? "KCalc" : "KCalc<2>",
  iconId: "kcalc",
  desktopId: 1,
  bounds: { x: 40, y: 30, width: 310, height: 300 },
  zIndex: isActive ? 2 : 1,
  isActive,
  state: "normal",
  isDraggable: true,
  minimumWidth: 292,
  minimumHeight: 270,
  isResizable: true,
});

const createWindowManager = (windows: readonly DesktopWindow[]): WindowManagerContextValue => ({
  windows,
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 },
  screenArea: { x: 0, y: 0, width: 900, height: 686 },
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

const renderKCalcs = (windows: readonly DesktopWindow[]) => {
  windowManager = createWindowManager(windows);
  act(() => {
    reactRoot.render(
      <WindowManagerContext.Provider value={windowManager}>
        <KCalcConstantsProvider initialConstants={createDefaultKCalcConstantRegistry()}>
          <StrictMode>
            {windows.map((desktopWindow) => (
              <WindowOwnedPopupLayer key={desktopWindow.id} desktopWindow={desktopWindow}>
                <KCalc
                  windowId={desktopWindow.id}
                  isActive={desktopWindow.isActive}
                  focusRequestId={desktopWindow.isActive ? 1 : 0}
                />
              </WindowOwnedPopupLayer>
            ))}
          </StrictMode>
        </KCalcConstantsProvider>
      </WindowManagerContext.Provider>,
    );
  });
};

const getRoot = (windowId = "app:kcalc"): HTMLDivElement => {
  const root = container.querySelector<HTMLDivElement>(`[data-kcalc-root='true'][data-window-id='${windowId}']`);

  if (!root) {
    throw new Error(`Missing KCalc root ${windowId}`);
  }

  return root;
};

const getButton = (scope: ParentNode, label: string): HTMLButtonElement => {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.replace(/^✓/, "") === label,
  );

  if (!button) {
    throw new Error(`Missing button ${label}`);
  }

  return button;
};

const click = (scope: ParentNode, label: string) => {
  act(() => {
    getButton(scope, label).click();
  });
};

const getPopup = (label: string): HTMLDivElement => {
  const popup = container.querySelector<HTMLDivElement>(`[aria-label='${label}']`);

  if (!popup) {
    throw new Error(`Missing popup ${label}`);
  }

  return popup;
};

const getStatus = (root: ParentNode) => Object.fromEntries(
  ["mode", "angle", "base"].map((slot) => [
    slot,
    root.querySelector<HTMLElement>(`[data-kcalc-status-slot='${slot}']`)?.textContent,
  ]),
);

const getStatusSlots = (root: ParentNode) => ["mode", "memory", "angle", "base"].map((slot) =>
  root.querySelector<HTMLElement>(`[data-kcalc-status-slot='${slot}']`)?.textContent,
);

const getCommandButton = (root: ParentNode, slotId: string): HTMLButtonElement => {
  const button = root.querySelector<HTMLButtonElement>(`[data-kcalc-command-slot='${slotId}']`);

  if (!button) {
    throw new Error(`Missing KCalc command slot ${slotId}`);
  }

  return button;
};

const clickCommand = (root: ParentNode, slotId: string) => {
  act(() => {
    getCommandButton(root, slotId).click();
  });
};

const enablePanel = (root: HTMLDivElement, label: string) => {
  click(root, "Settings");
  click(getPopup("Settings menu"), label);
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("kcalc-angle-menu")) {
      return rect(0, 0, 104, 67);
    }

    if (this.classList.contains("kcalc-menu-popup")) {
      return this.classList.contains("kcalc-settings-menu") ? rect(0, 0, 236, 220) : rect(0, 0, 116, 25);
    }

    if (this.classList.contains("kcalc-auxiliary-selector")) {
      return rect(860, 600, 35, 27);
    }

    if (this.classList.contains("kcalc-menuitem") && this.textContent === "Settings") {
      return rect(100, 31, 48, 20);
    }

    if (this.classList.contains("kcalc-menuitem") && this.textContent === "File") {
      return rect(40, 31, 34, 20);
    }

    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("KCalc mode controls", () => {
  it("keeps four stable status slots and toggles INV without calculator behavior", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();

    expect(getStatusSlots(root)).toEqual(["NORM", "", "", ""]);
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "", base: "" });
    expect(getButton(root, "Inv").getAttribute("aria-pressed")).toBe("false");
    click(root, "Inv");
    expect(getStatusSlots(root)).toEqual(["INV", "", "", ""]);
    expect(getButton(root, "Inv").classList.contains("is-active")).toBe(true);
    expect(getStatus(root)).toEqual({ mode: "INV", angle: "", base: "" });
    click(root, "Inv");
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "", base: "" });
  });

  it("renders pow10 and exp with the shared semantic superscript label without resizing", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "Inv");
    const pow10 = getCommandButton(root, "science-log");
    const exp = getCommandButton(root, "science-ln");
    expect(pow10).toMatchObject({ textContent: "10x", dataset: { kcalcCommandId: "pow10" }, ariaLabel: "10 to the power of x" });
    expect(exp).toMatchObject({ textContent: "ex", dataset: { kcalcCommandId: "exp" }, ariaLabel: "e to the power of x" });
    expect(pow10.querySelector(".kcalc-math-label > sup")?.textContent).toBe("x");
    expect(exp.querySelector(".kcalc-math-label > sup")?.textContent).toBe("x");
    expect(pow10.textContent).not.toContain("ˣ");
    expect(exp.textContent).not.toContain("ˣ");

    click(root, "Inv");
    expect(getCommandButton(root, "science-log")).toMatchObject({ textContent: "Log", dataset: { kcalcCommandId: "log10" } });
    expect(getCommandButton(root, "science-ln")).toMatchObject({ textContent: "Ln", dataset: { kcalcCommandId: "ln" } });
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("uses shared semantic math labels and a structured Base group without moving the button bank", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Statistic Buttons");
    const sampleStandardDeviation = getCommandButton(root, "statistics-sample-standard-deviation");

    expect(sampleStandardDeviation.dataset.kcalcCommandId).toBe("stat-sample-standard-deviation");
    expect(sampleStandardDeviation.querySelector(".kcalc-math-label--subscript > sub")?.textContent).toBe("N−1");
    expect(sampleStandardDeviation.querySelector("sup")).toBeNull();

    click(root, "Inv");
    const populationStandardDeviation = getCommandButton(root, "statistics-sample-standard-deviation");
    expect(populationStandardDeviation.dataset.kcalcCommandId).toBe("stat-population-standard-deviation");
    expect(populationStandardDeviation.querySelector(".kcalc-math-label--subscript > sub")?.textContent).toBe("N");

    enablePanel(root, "Logic Buttons");
    const baseSelector = root.querySelector<HTMLFieldSetElement>("fieldset.kcalc-base-selector");
    const baseOptions = baseSelector?.querySelector<HTMLElement>("[role='radiogroup']");
    expect(baseSelector?.querySelector("legend")?.textContent).toBe("Base");
    expect(baseOptions?.querySelectorAll("[role='radio']")).toHaveLength(4);
    expect(baseSelector?.querySelector("legend")?.getAttribute("role")).toBeNull();
    expect(baseOptions?.textContent).toBe("HexDecOctBin");
    expect(baseOptions?.querySelector("[data-kcalc-base-option='dec']")?.getAttribute("aria-checked")).toBe("true");
    click(baseOptions as HTMLElement, "Hex");
    expect(baseOptions?.querySelector("[data-kcalc-base-option='hex']")?.getAttribute("aria-checked")).toBe("true");

    const buttonBank = root.querySelector<HTMLElement>("[data-kcalc-layout='button-bank']");
    const statusStrip = root.querySelector<HTMLElement>("[data-kcalc-layout='status-strip']");
    const coreKeypad = root.querySelector<HTMLElement>("[data-kcalc-layout-module='core-calculator']");
    const statisticsColumn = root.querySelector<HTMLElement>("[data-kcalc-layout-module='statistics']");
    const baseScientificColumn = root.querySelector<HTMLElement>("[data-kcalc-layout-module='base-scientific']");

    expect(root.querySelector("[data-kcalc-layout='top-control-band']")).not.toBeNull();
    expect(coreKeypad?.parentElement).toBe(buttonBank);
    expect(statusStrip?.parentElement).toBe(buttonBank?.parentElement);
    expect(coreKeypad?.contains(statusStrip)).toBe(false);
    expect(statusStrip?.querySelectorAll("[data-kcalc-status-slot]")).toHaveLength(4);
    expect([statisticsColumn, baseScientificColumn, coreKeypad].map((element) => element?.dataset.kcalcRowCount)).toEqual(["6", "6", "5"]);
    expect([statisticsColumn, baseScientificColumn, coreKeypad].map((element) => element?.dataset.kcalcButtonBankHeight)).toEqual(["shared", "shared", "shared"]);

    click(root, "Settings");
    click(getPopup("Settings menu"), "Show All");
    expect([...root.querySelectorAll<HTMLElement>("[data-kcalc-row-count='6']")].map((element) => element.dataset.kcalcLayoutModule)).toEqual([
      "statistics",
      "science",
      "logic-operations",
      "base-scientific",
      "logic-digits",
      "constants",
    ]);
  });

  it("uses Base as an exact per-instance input and presentation mode while keeping Logic enabled", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Logic Buttons");
    enablePanel(root, "Science/Engineering Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    const baseSelector = root.querySelector<HTMLElement>("fieldset[aria-label='Base selector']");
    const decimalPoint = getButton(root, ".");
    const digitA = root.querySelector<HTMLButtonElement>("[data-kcalc-radix-digit='A']");

    expect(digitA?.disabled).toBe(true);
    expect(decimalPoint.disabled).toBe(false);
    expect(getCommandButton(root, "science-sin").disabled).toBe(false);
    expect(getButton(root, "AND").disabled).toBe(false);

    click(root, "Inv");
    click(baseSelector as HTMLElement, "Hex");
    expect(getStatusSlots(root)).toEqual(["INV", "", "DEG", "HEX"]);
    expect(root.querySelector(".kcalc-display-mode")?.textContent).toBe("Hex");
    expect(digitA?.disabled).toBe(false);
    expect(decimalPoint.disabled).toBe(true);
    expect(getCommandButton(root, "science-sin")).toMatchObject({ disabled: true, dataset: { kcalcCommandId: "asin" } });
    expect(getCommandButton(root, "science-hyp").disabled).toBe(true);
    expect(getButton(root, "AND").disabled).toBe(false);

    click(root, "A");
    click(root, "F");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("AF");
    click(baseSelector as HTMLElement, "Dec");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("175");
    expect(getStatusSlots(root)).toEqual(["INV", "", "DEG", "DEC"]);
    expect(root.querySelector(".kcalc-display-mode")?.textContent).toBe("Dec");
    expect(decimalPoint.disabled).toBe(false);
    expect(getCommandButton(root, "science-sin")).toMatchObject({ disabled: false, dataset: { kcalcCommandId: "asin" } });
    click(root, "5");
    click(root, "AND");
    expect(getStatusSlots(root)).toEqual(["NORM", "", "DEG", "DEC"]);
    click(root, "3");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("1");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("derives number-command availability from exact value magnitude without restricting radix entry", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Logic Buttons");
    enablePanel(root, "Science/Engineering Buttons");
    enablePanel(root, "Statistic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "Hex");
    for (const digit of "20000000000000") {
      click(root, digit);
    }

    for (const label of ["+", "-", "×", "/", "MS"]) {
      expect(getButton(root, label).disabled).toBe(true);
    }
    expect(getCommandButton(root, "statistics-data").disabled).toBe(true);
    expect(getCommandButton(root, "science-sin").disabled).toBe(true);
    for (const label of ["AND", "OR", "XOR", "Lsh", "Rsh", "Cmp"]) {
      expect(getButton(root, label).disabled).toBe(false);
    }
    expect(getCommandButton(root, "statistics-count").disabled).toBe(false);
    expect(getCommandButton(root, "statistics-clear").disabled).toBe(false);

    click(root, "Dec");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("9007199254740992");
    expect(getButton(root, "×").disabled).toBe(true);
    expect(getCommandButton(root, "science-sin").disabled).toBe(true);

    click(root, "C");
    click(root, "5");
    expect(getButton(root, "×").disabled).toBe(false);
    expect(getButton(root, "MS").disabled).toBe(false);
    expect(getCommandButton(root, "statistics-data").disabled).toBe(false);
    expect(getCommandButton(root, "science-sin").disabled).toBe(false);
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("derives the fixed Memory status slot from calculator memory without changing geometry", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "2");
    click(root, "0");
    click(root, "MS");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "5");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "MR");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("20");

    click(root, "C");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "AC");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "0");
    click(root, "1/x");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("Error");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "5");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);

    click(root, "MC");
    expect(getStatusSlots(root)).toEqual(["NORM", "", "", ""]);
    click(root, "AC");
    click(root, "0");
    click(root, "MS");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "MC");
    click(root, "5");
    click(root, "M+");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "MC");
    click(root, "5");
    click(root, "Inv");
    click(root, "M-");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("keeps the Memory status slot isolated between exact KCalc instances", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);

    click(firstRoot, "2");
    click(firstRoot, "0");
    click(firstRoot, "MS");
    expect(getStatusSlots(firstRoot)).toEqual(["NORM", "M", "", ""]);
    expect(getStatusSlots(secondRoot)).toEqual(["NORM", "", "", ""]);
    click(firstRoot, "MC");
    expect(getStatusSlots(firstRoot)).toEqual(["NORM", "", "", ""]);
    expect(getStatusSlots(secondRoot)).toEqual(["NORM", "", "", ""]);
  });

  it("keeps the Memory slot between mode and optional Angle/Base slots through INV and Hyp", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();

    click(root, "0");
    click(root, "MS");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    enablePanel(root, "Science/Engineering Buttons");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "DEG", ""]);
    click(root, "Settings");
    click(getPopup("Settings menu"), "Logic Buttons");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "DEG", "DEC"]);
    click(root, "Inv");
    expect(getStatusSlots(root)).toEqual(["INV", "M", "DEG", "DEC"]);
    click(root, "Hyp");
    expect(getStatusSlots(root)).toEqual(["INV", "M", "DEG", "DEC"]);
    click(root, "Settings");
    click(getPopup("Settings menu"), "Hide All");
    expect(getStatusSlots(root)).toEqual(["INV", "M", "", ""]);
  });

  it("resolves the audited INV command surfaces in place without changing the required window width", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    click(root, "Settings");
    click(getPopup("Settings menu"), "Show All");
    vi.mocked(windowManager.resizeWindow).mockClear();

    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sin", disabled: false });
    expect(getCommandButton(root, "base-mod")).toMatchObject({ textContent: "Mod", disabled: false });
    expect(getCommandButton(root, "statistics-count")).toMatchObject({ textContent: "N", disabled: false });
    expect(getCommandButton(root, "constant-1")).toMatchObject({ textContent: "C1", disabled: false });
    expect(getCommandButton(root, "memory-add")).toMatchObject({ textContent: "M+", dataset: { kcalcCommandId: "memory-add" }, disabled: false });

    click(root, "Inv");

    expect(getCommandButton(root, "science-hyp")).toMatchObject({ textContent: "Hyp", dataset: { kcalcCommandId: "hyp" } });
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Asin", dataset: { kcalcCommandId: "asin" } });
    expect(getCommandButton(root, "science-cos")).toMatchObject({ textContent: "Acos", dataset: { kcalcCommandId: "acos" } });
    expect(getCommandButton(root, "science-tan")).toMatchObject({ textContent: "Atan", dataset: { kcalcCommandId: "atan" } });
    expect(getCommandButton(root, "science-log")).toMatchObject({ textContent: "10x", dataset: { kcalcCommandId: "pow10" } });
    expect(getCommandButton(root, "science-ln")).toMatchObject({ textContent: "ex", dataset: { kcalcCommandId: "exp" } });
    expect(getCommandButton(root, "base-mod")).toMatchObject({ textContent: "IntDiv", dataset: { kcalcCommandId: "int-div" } });
    expect(getCommandButton(root, "base-reciprocal")).toMatchObject({ textContent: "1/x", dataset: { kcalcCommandId: "reciprocal" } });
    expect(getCommandButton(root, "base-factorial")).toMatchObject({ textContent: "x!", dataset: { kcalcCommandId: "factorial" } });
    expect(getCommandButton(root, "base-square")).toMatchObject({ textContent: "x³", dataset: { kcalcCommandId: "cube" } });
    expect(getCommandButton(root, "base-root")).toMatchObject({ textContent: "∛x", dataset: { kcalcCommandId: "cuberoot" } });
    expect(getCommandButton(root, "base-power")).toMatchObject({ textContent: "x1/y", dataset: { kcalcCommandId: "inverse-power" } });
    expect(getCommandButton(root, "scientific-entry")).toMatchObject({ textContent: "x·10ʸ", dataset: { kcalcCommandId: "scientific-entry" } });
    expect(getCommandButton(root, "statistics-count")).toMatchObject({ textContent: "Σx", dataset: { kcalcCommandId: "stat-sum" } });
    expect(getCommandButton(root, "statistics-mean")).toMatchObject({ textContent: "Σx2", dataset: { kcalcCommandId: "stat-sum-squares" } });
    expect(getCommandButton(root, "statistics-sample-standard-deviation")).toMatchObject({ textContent: "σN", dataset: { kcalcCommandId: "stat-population-standard-deviation" } });
    expect(getCommandButton(root, "statistics-data")).toMatchObject({ textContent: "CDat", dataset: { kcalcCommandId: "stat-delete-data" } });
    expect(getCommandButton(root, "statistics-median")).toMatchObject({ textContent: "Med", dataset: { kcalcCommandId: "stat-median" } });
    expect(getCommandButton(root, "statistics-clear")).toMatchObject({ textContent: "CSt", dataset: { kcalcCommandId: "stat-clear-inverse-noop" } });
    expect(getCommandButton(root, "memory-add")).toMatchObject({ textContent: "M-", dataset: { kcalcCommandId: "memory-subtract" }, disabled: false });
    expect(getButton(root, "MR")).toMatchObject({ disabled: true });
    expect(getButton(root, "MS")).toMatchObject({ disabled: false });
    expect(getButton(root, "MC")).toMatchObject({ disabled: false });
    expect(getButton(root, "%")).toMatchObject({ disabled: false });
    expect(getButton(root, "±")).toMatchObject({ disabled: false });
    expect([...root.querySelectorAll<HTMLButtonElement>("[data-kcalc-command-slot^='constant-']")]).toHaveLength(6);
    expect([...root.querySelectorAll<HTMLButtonElement>("[data-kcalc-command-slot^='constant-']")].map((button) => [button.textContent, button.dataset.kcalcCommandId, button.disabled])).toEqual([
      ["Store", "store-constant-1", false],
      ["Store", "store-constant-2", false],
      ["Store", "store-constant-3", false],
      ["Store", "store-constant-4", false],
      ["Store", "store-constant-5", false],
      ["Store", "store-constant-6", false],
    ]);
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();

    click(root, "Inv");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sin", dataset: { kcalcCommandId: "sin" } });
    expect(getCommandButton(root, "base-mod")).toMatchObject({ textContent: "Mod", dataset: { kcalcCommandId: "mod" } });
    expect(getCommandButton(root, "statistics-count")).toMatchObject({ textContent: "N", dataset: { kcalcCommandId: "stat-count" } });
    expect(getCommandButton(root, "constant-1")).toMatchObject({ textContent: "C1", dataset: { kcalcCommandId: "constant-1" } });
    expect(getCommandButton(root, "memory-add")).toMatchObject({ textContent: "M+", dataset: { kcalcCommandId: "memory-add" }, disabled: false });
  });

  it("captures direct Dat entries without finalizing pending arithmetic and makes CDat safely available", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Statistic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    expect(getCommandButton(root, "statistics-count")).toMatchObject({ disabled: false });
    expect(getCommandButton(root, "statistics-data")).toMatchObject({ textContent: "Dat", disabled: false });
    expect(getCommandButton(root, "statistics-clear")).toMatchObject({ textContent: "CSt", disabled: false });

    click(root, "2");
    click(root, "+");
    click(root, "3");
    clickCommand(root, "statistics-data");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("1");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("3");

    click(root, "5");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");
    clickCommand(root, "statistics-data");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("2");

    click(root, "Inv");
    expect(getCommandButton(root, "statistics-data")).toMatchObject({ textContent: "CDat", dataset: { kcalcCommandId: "stat-delete-data" }, disabled: false });
    clickCommand(root, "statistics-data");
    expect(getStatus(root).mode).toBe("NORM");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");
    click(root, "5");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");

    click(root, "Inv");
    clickCommand(root, "statistics-data");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");
    click(root, "Inv");
    expect(getCommandButton(root, "statistics-data")).toMatchObject({ textContent: "CDat", disabled: true });
    expect(getStatus(root).mode).toBe("INV");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("keeps CSt isolated from calculator state and preserves the KDE3 inverse no-op", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Statistic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "2");
    click(root, "0");
    click(root, "MS");
    clickCommand(root, "statistics-data");
    click(root, "2");
    click(root, "+");
    click(root, "3");
    clickCommand(root, "statistics-clear");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("3");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");

    click(root, "7");
    clickCommand(root, "statistics-data");
    click(root, "Inv");
    expect(getCommandButton(root, "statistics-clear")).toMatchObject({ dataset: { kcalcCommandId: "stat-clear-inverse-noop" }, disabled: false });
    clickCommand(root, "statistics-clear");
    expect(getStatus(root).mode).toBe("NORM");
    click(root, "Inv");
    expect(getCommandButton(root, "statistics-data")).toMatchObject({ textContent: "CDat", disabled: false });
    click(root, "Inv");

    click(root, "C");
    click(root, "AC");
    expect(getStatusSlots(root)).toEqual(["NORM", "M", "", ""]);
    click(root, "Inv");
    expect(getCommandButton(root, "statistics-data")).toMatchObject({ textContent: "CDat", disabled: false });
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("preserves per-instance statistics datasets across panel visibility without adding a status slot", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    enablePanel(firstRoot, "Statistic Buttons");
    enablePanel(secondRoot, "Statistic Buttons");

    click(firstRoot, "1");
    click(firstRoot, "0");
    clickCommand(firstRoot, "statistics-data");
    expect(getStatusSlots(firstRoot)).toEqual(["NORM", "", "", ""]);
    expect(getStatusSlots(secondRoot)).toEqual(["NORM", "", "", ""]);

    click(firstRoot, "Settings");
    click(getPopup("Settings menu"), "Statistic Buttons");
    enablePanel(firstRoot, "Statistic Buttons");
    click(firstRoot, "Inv");
    expect(getCommandButton(firstRoot, "statistics-data")).toMatchObject({ textContent: "CDat", disabled: false });
    click(secondRoot, "Inv");
    expect(getCommandButton(secondRoot, "statistics-data")).toMatchObject({ textContent: "CDat", disabled: true });
  });

  it("enables Statistics queries with the empty-data matrix and consumes INV through inverse surfaces", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Statistic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    for (const slotId of ["statistics-count", "statistics-mean", "statistics-sample-standard-deviation", "statistics-median"]) {
      expect(getCommandButton(root, slotId)).toMatchObject({ disabled: false });
    }
    clickCommand(root, "statistics-count");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");

    click(root, "Inv");
    expect(getCommandButton(root, "statistics-count")).toMatchObject({ textContent: "Σx", dataset: { kcalcCommandId: "stat-sum" }, disabled: false });
    clickCommand(root, "statistics-count");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");
    expect(getStatus(root).mode).toBe("NORM");

    clickCommand(root, "statistics-mean");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("Error");
    click(root, "5");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");

    click(root, "Inv");
    expect(getCommandButton(root, "statistics-sample-standard-deviation")).toMatchObject({ textContent: "σN", dataset: { kcalcCommandId: "stat-population-standard-deviation" } });
    clickCommand(root, "statistics-sample-standard-deviation");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("Error");
    expect(getStatus(root).mode).toBe("NORM");
    click(root, "5");
    click(root, "Inv");
    expect(getCommandButton(root, "statistics-median")).toMatchObject({ textContent: "Med", dataset: { kcalcCommandId: "stat-median" } });
    clickCommand(root, "statistics-median");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("Error");
    expect(getStatus(root).mode).toBe("NORM");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("keeps query results, median insertion order, pending arithmetic, and query-to-Dat in the reducer-owned dataset", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Statistic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    for (const value of ["3", "1", "2"]) {
      click(root, value);
      clickCommand(root, "statistics-data");
    }
    clickCommand(root, "statistics-median");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("2");
    click(root, "Inv");
    clickCommand(root, "statistics-median");
    expect(getStatus(root).mode).toBe("NORM");
    click(root, "Inv");
    clickCommand(root, "statistics-data");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");

    click(root, "2");
    click(root, "+");
    clickCommand(root, "statistics-mean");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("4");

    clickCommand(root, "statistics-sample-standard-deviation");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("1.41421356237");
    click(root, "5");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");
    click(root, "Inv");
    clickCommand(root, "statistics-count");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("4");
    clickCommand(root, "statistics-data");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("3");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("keeps statistical query results isolated between exact KCalc instances", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    enablePanel(firstRoot, "Statistic Buttons");
    enablePanel(secondRoot, "Statistic Buttons");

    for (const value of ["1", "2", "3"]) {
      click(firstRoot, value);
      clickCommand(firstRoot, "statistics-data");
    }
    for (const value of ["10", "20"]) {
      for (const digit of value) {
        click(secondRoot, digit);
      }
      clickCommand(secondRoot, "statistics-data");
    }
    clickCommand(firstRoot, "statistics-mean");
    clickCommand(secondRoot, "statistics-mean");
    expect((firstRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("2");
    expect((secondRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("15");
  });

  it("mounts hidden panels directly in their current INV surface and preserves a pending calculation", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    click(root, "1");
    click(root, "2");
    click(root, "+");
    click(root, "Inv");

    enablePanel(root, "Science/Engineering Buttons");
    enablePanel(root, "Statistic Buttons");
    enablePanel(root, "Constants Buttons");
    expect(getCommandButton(root, "science-sin").dataset.kcalcCommandId).toBe("asin");
    expect(getCommandButton(root, "statistics-count").dataset.kcalcCommandId).toBe("stat-sum");
    expect(getCommandButton(root, "constant-1").dataset.kcalcCommandId).toBe("store-constant-1");

    click(root, "Settings");
    click(getPopup("Settings menu"), "Hide All");
    expect(getStatus(root)).toEqual({ mode: "INV", angle: "", base: "" });
    click(root, "Settings");
    click(getPopup("Settings menu"), "Show All");
    expect(getCommandButton(root, "science-sin").dataset.kcalcCommandId).toBe("asin");
    expect(getCommandButton(root, "statistics-count").dataset.kcalcCommandId).toBe("stat-sum");
    expect(getCommandButton(root, "constant-1").dataset.kcalcCommandId).toBe("store-constant-1");

    click(root, "3");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("15");
  });

  it("opens the owner-scoped Angle popup, persists its selection across panel visibility, and lets Escape close it", () => {
    const desktopWindow = createDesktopWindow("app:kcalc", true);
    renderKCalcs([desktopWindow]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");

    click(root, "Angle");
    const angleMenu = getPopup("Angle menu");
    expect(angleMenu.parentElement?.dataset.windowId).toBe(desktopWindow.id);
    expect(angleMenu.dataset.positioned).toBe("true");
    expect(angleMenu.style.left).toBe("796px");
    expect(angleMenu.style.top).toBe("619px");
    expect([...angleMenu.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']")].map((button) => button.textContent?.replace("✓", ""))).toEqual([
      "Degrees",
      "Radians",
      "Gradians",
    ]);
    expect(getButton(angleMenu, "Degrees").getAttribute("aria-checked")).toBe("true");

    click(angleMenu, "Radians");
    expect(container.querySelector("[aria-label='Angle menu']")).toBeNull();
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "RAD", base: "" });
    expect(document.activeElement).toBe(root);

    click(root, "Settings");
    click(getPopup("Settings menu"), "Science/Engineering Buttons");
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "", base: "" });
    enablePanel(root, "Science/Engineering Buttons");
    click(root, "Angle");
    expect(getButton(getPopup("Angle menu"), "Radians").getAttribute("aria-checked")).toBe("true");
    act(() => {
      root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    expect(container.querySelector("[aria-label='Angle menu']")).toBeNull();

    click(root, "Angle");
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(container.querySelector("[aria-label='Angle menu']")).toBeNull();
  });

  it("keeps the Base group selection through Hide All without changing arithmetic behavior", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Logic Buttons");

    const baseSelector = root.querySelector<HTMLFieldSetElement>("fieldset[aria-label='Base selector']");
    expect(baseSelector?.querySelector("legend")?.textContent).toBe("Base");
    expect(baseSelector?.querySelector("[role='radiogroup']")).not.toBeNull();
    expect(getButton(root, "Dec").getAttribute("aria-checked")).toBe("true");
    click(root, "Hex");
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "", base: "HEX" });
    expect(getButton(root, "Hex").getAttribute("aria-checked")).toBe("true");
    expect(getButton(root, "Dec").getAttribute("aria-checked")).toBe("false");

    click(root, "Settings");
    click(getPopup("Settings menu"), "Hide All");
    expect(root.querySelector("[aria-label='Base selector']")).toBeNull();
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "", base: "" });
    enablePanel(root, "Logic Buttons");
    expect(getButton(root, "Hex").getAttribute("aria-checked")).toBe("true");

    click(root, "2");
    click(root, "+");
    click(root, "3");
    click(root, "×");
    click(root, "4");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("14");
    expect(getButton(root, "A").disabled).toBe(false);
    expect(getButton(root, "AND").disabled).toBe(false);
  });

  it("keeps C and Error in persistent Hyp plus INV, while AC exits only INV without clearing memory, angle, or base", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");
    enablePanel(root, "Logic Buttons");
    click(root, "Angle");
    click(getPopup("Angle menu"), "Radians");
    click(root, "Hyp");
    click(root, "Inv");
    click(root, "Hex");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Asinh", dataset: { kcalcCommandId: "asinh" }, disabled: true });

    click(root, "5");
    click(root, "MS");
    click(root, "1");
    click(root, "/");
    click(root, "0");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("Error");
    expect(getStatus(root)).toEqual({ mode: "INV", angle: "RAD", base: "HEX" });

    click(root, "7");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("7");
    expect(getStatus(root)).toEqual({ mode: "INV", angle: "RAD", base: "HEX" });
    click(root, "C");
    expect(getStatus(root)).toEqual({ mode: "INV", angle: "RAD", base: "HEX" });
    expect(getButton(root, "Hyp").getAttribute("aria-pressed")).toBe("true");
    expect(getCommandButton(root, "science-cos")).toMatchObject({ textContent: "Acosh", dataset: { kcalcCommandId: "acosh" }, disabled: true });
    expect(getCommandButton(root, "base-square")).toMatchObject({ textContent: "x³", dataset: { kcalcCommandId: "cube" } });
    click(root, "AC");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "RAD", base: "HEX" });
    expect(getButton(root, "Hyp").getAttribute("aria-pressed")).toBe("true");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sinh", dataset: { kcalcCommandId: "sinh" }, disabled: true });
    click(root, "MR");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");
  });

  it("isolates mode state per instance and does not request a width change for mode-only interactions", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    enablePanel(firstRoot, "Science/Engineering Buttons");
    enablePanel(firstRoot, "Logic Buttons");
    enablePanel(secondRoot, "Science/Engineering Buttons");
    enablePanel(secondRoot, "Logic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(firstRoot, "Inv");
    click(firstRoot, "Hyp");
    click(firstRoot, "Angle");
    click(getPopup("Angle menu"), "Gradians");
    click(firstRoot, "Bin");

    expect(getStatus(firstRoot)).toEqual({ mode: "INV", angle: "GRA", base: "BIN" });
    expect(getCommandButton(firstRoot, "science-tan")).toMatchObject({ textContent: "Atanh", dataset: { kcalcCommandId: "atanh" }, disabled: true });
    expect(getStatus(secondRoot)).toEqual({ mode: "NORM", angle: "DEG", base: "DEC" });
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("keeps INV command surfaces isolated between exact KCalc instances", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    enablePanel(firstRoot, "Science/Engineering Buttons");
    enablePanel(firstRoot, "Constants Buttons");
    enablePanel(secondRoot, "Science/Engineering Buttons");
    enablePanel(secondRoot, "Constants Buttons");

    click(firstRoot, "Hyp");
    click(firstRoot, "Inv");

    expect(getCommandButton(firstRoot, "science-sin")).toMatchObject({ textContent: "Asinh", dataset: { kcalcCommandId: "asinh" } });
    expect(getCommandButton(firstRoot, "constant-1")).toMatchObject({ textContent: "Store", dataset: { kcalcCommandId: "store-constant-1" } });
    expect(getCommandButton(firstRoot, "memory-add")).toMatchObject({ textContent: "M-", dataset: { kcalcCommandId: "memory-subtract" } });
    expect(getCommandButton(secondRoot, "science-sin")).toMatchObject({ textContent: "Sin", dataset: { kcalcCommandId: "sin" } });
    expect(getCommandButton(secondRoot, "constant-1")).toMatchObject({ textContent: "C1", dataset: { kcalcCommandId: "constant-1" } });
    expect(getCommandButton(secondRoot, "memory-add")).toMatchObject({ textContent: "M+", dataset: { kcalcCommandId: "memory-add" } });
  });

  it("keeps Hyp persistent through ordered INV toggles and panel visibility without changing calculator state or width", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "1");
    click(root, "2");
    click(root, "+");
    click(root, "Hyp");
    expect(getButton(root, "Hyp").disabled).toBe(false);
    expect(getButton(root, "Hyp").getAttribute("aria-pressed")).toBe("true");
    expect(getButton(root, "Hyp").classList.contains("is-active")).toBe(true);
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "DEG", base: "" });
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sinh", dataset: { kcalcCommandId: "sinh" }, disabled: false });
    expect(getCommandButton(root, "science-log")).toMatchObject({ textContent: "Log", dataset: { kcalcCommandId: "log10" }, disabled: false });

    click(root, "Inv");
    expect(getButton(root, "Inv").classList.contains("is-active")).toBe(true);
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Asinh", dataset: { kcalcCommandId: "asinh" }, disabled: false });
    expect(getCommandButton(root, "science-cos")).toMatchObject({ textContent: "Acosh", dataset: { kcalcCommandId: "acosh" }, disabled: false });
    expect(getCommandButton(root, "science-tan")).toMatchObject({ textContent: "Atanh", dataset: { kcalcCommandId: "atanh" }, disabled: false });
    expect(getCommandButton(root, "science-log")).toMatchObject({ textContent: "10x", dataset: { kcalcCommandId: "pow10" }, disabled: false });
    expect(getCommandButton(root, "science-ln")).toMatchObject({ textContent: "ex", dataset: { kcalcCommandId: "exp" }, disabled: false });

    click(root, "Inv");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sinh", dataset: { kcalcCommandId: "sinh" } });
    click(root, "Inv");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Asinh", dataset: { kcalcCommandId: "asinh" } });

    click(root, "Settings");
    click(getPopup("Settings menu"), "Science/Engineering Buttons");
    expect(root.querySelector("[aria-label='Science and engineering buttons']")).toBeNull();
    expect(getStatus(root)).toEqual({ mode: "INV", angle: "", base: "" });
    enablePanel(root, "Science/Engineering Buttons");
    expect(getButton(root, "Hyp").getAttribute("aria-pressed")).toBe("true");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Asinh", dataset: { kcalcCommandId: "asinh" } });
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "3");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("15");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("executes Science descriptors with a captured Angle context while preserving one-shot INV and persistent Hyp", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(root, "3");
    click(root, "0");
    click(root, "Sin");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0.5");
    click(root, "2");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("2");

    click(root, "AC");
    click(root, "2");
    click(root, "+");
    click(root, "3");
    click(root, "0");
    click(root, "Sin");
    click(root, "=");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("2.5");

    click(root, "AC");
    click(root, "0");
    click(root, ".");
    click(root, "5");
    click(root, "Inv");
    click(root, "Asin");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("30");
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "DEG", base: "" });
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sin", dataset: { kcalcCommandId: "sin" } });

    click(root, "AC");
    click(root, "1");
    click(root, "Hyp");
    click(root, "Inv");
    click(root, "Asinh");
    expect(Number((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value)).toBeCloseTo(Math.asinh(1));
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "DEG", base: "" });
    expect(getButton(root, "Hyp").getAttribute("aria-pressed")).toBe("true");
    expect(getCommandButton(root, "science-sin")).toMatchObject({ textContent: "Sinh", dataset: { kcalcCommandId: "sinh" } });

    click(root, "AC");
    click(root, "0");
    click(root, "Inv");
    click(root, "Acosh");
    expect((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("Error");
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "DEG", base: "" });
    expect(getButton(root, "Hyp").getAttribute("aria-pressed")).toBe("true");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("executes inverse logarithmic commands once and keeps Science Angle state isolated per instance", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    enablePanel(firstRoot, "Science/Engineering Buttons");
    enablePanel(secondRoot, "Science/Engineering Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(firstRoot, "2");
    click(firstRoot, "Inv");
    click(firstRoot, "10x");
    expect((firstRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("100");
    expect(getStatus(firstRoot)).toEqual({ mode: "NORM", angle: "DEG", base: "" });
    expect(getCommandButton(firstRoot, "science-log")).toMatchObject({ textContent: "Log", dataset: { kcalcCommandId: "log10" } });

    click(firstRoot, "AC");
    click(firstRoot, "1");
    click(firstRoot, "Inv");
    click(firstRoot, "ex");
    expect(Number((firstRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value)).toBeCloseTo(Math.E);
    expect(getStatus(firstRoot)).toEqual({ mode: "NORM", angle: "DEG", base: "" });

    click(secondRoot, "Angle");
    click(getPopup("Angle menu"), "Radians");
    click(secondRoot, "3");
    click(secondRoot, "0");
    click(secondRoot, "Sin");
    expect(Number((secondRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value)).toBeCloseTo(Math.sin(30));
    expect((firstRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).not.toBe("0");
    expect(getStatus(secondRoot)).toEqual({ mode: "NORM", angle: "RAD", base: "" });
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("uses the Angle snapshot for circular commands while hyperbolic commands ignore it", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");

    click(root, "Angle");
    click(getPopup("Angle menu"), "Radians");
    click(root, "1");
    click(root, "Sin");
    expect(Number((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value)).toBeCloseTo(Math.sin(1));

    click(root, "AC");
    click(root, "1");
    click(root, "Hyp");
    click(root, "Sinh");
    expect(Number((root.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value)).toBeCloseTo(Math.sinh(1));
    expect(getStatus(root)).toEqual({ mode: "NORM", angle: "RAD", base: "" });
  });

  it("consumes INV in only the exact instance that selects a secondary command without requesting a resize", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(firstRoot, "Inv");
    click(secondRoot, "Inv");
    click(firstRoot, "x³");

    expect(getStatus(firstRoot)).toEqual({ mode: "NORM", angle: "", base: "" });
    expect(getStatus(secondRoot)).toEqual({ mode: "INV", angle: "", base: "" });
    expect(getCommandButton(firstRoot, "base-square")).toMatchObject({ textContent: "x²", dataset: { kcalcCommandId: "square" } });
    expect(getCommandButton(secondRoot, "base-square")).toMatchObject({ textContent: "x³", dataset: { kcalcCommandId: "cube" } });
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("shares stored constants across mounted KCalc instances without changing another display", () => {
    const first = createDesktopWindow("app:kcalc", true);
    const second = createDesktopWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);
    enablePanel(firstRoot, "Constants Buttons");
    enablePanel(secondRoot, "Constants Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();

    click(firstRoot, "5");
    click(firstRoot, "Inv");
    expect(getCommandButton(firstRoot, "constant-1")).toMatchObject({ textContent: "Store", disabled: false });
    clickCommand(firstRoot, "constant-1");

    expect((firstRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");
    expect((secondRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("0");
    expect(getStatus(firstRoot).mode).toBe("NORM");
    clickCommand(secondRoot, "constant-1");
    expect((secondRoot.querySelector("[aria-label='Calculator display']") as HTMLInputElement).value).toBe("5");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("uses one popup request stream when switching from Settings to Angle and then File", () => {
    renderKCalcs([createDesktopWindow("app:kcalc", true)]);
    const root = getRoot();
    enablePanel(root, "Science/Engineering Buttons");

    click(root, "Settings");
    expect(getPopup("Settings menu").dataset.menuRequestId).toBe("2");
    click(root, "Angle");
    expect(container.querySelector("[aria-label='Settings menu']")).toBeNull();
    expect(getPopup("Angle menu").dataset.menuRequestId).toBe("3");
    click(root, "File");
    expect(container.querySelector("[aria-label='Angle menu']")).toBeNull();
    expect(getPopup("File menu").dataset.menuRequestId).toBe("4");
  });
});
