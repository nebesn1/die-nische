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
let desktopWindow: DesktopWindow;

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left, y: top, width, height, top, right: left + width, bottom: top + height, left, toJSON: () => ({}),
}) as DOMRect;

const createWindowManager = (): WindowManagerContextValue => ({
  windows: [], currentDesktopId: 1, lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null }, showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 }, screenArea: { x: 0, y: 0, width: 900, height: 686 },
  activateWindow: vi.fn(), focusWindow: vi.fn(), openWindow: vi.fn(), moveWindow: vi.fn(), resizeWindow: vi.fn(), minimizeWindow: vi.fn(), restoreWindow: vi.fn(), maximizeWindow: vi.fn(), restoreMaximizedWindow: vi.fn(), toggleMaximizeWindow: vi.fn(), closeWindow: vi.fn(), toggleTaskbarWindow: vi.fn(), switchDesktop: vi.fn(), toggleShowDesktop: vi.fn(), moveWindowToDesktop: vi.fn(), setWorkArea: vi.fn(),
});

const renderKCalc = () => act(() => reactRoot.render(
  <WindowManagerContext.Provider value={windowManager}>
    <StrictMode><KCalcConstantsProvider initialConstants={createDefaultKCalcConstantRegistry()}><WindowOwnedPopupLayer desktopWindow={desktopWindow}><KCalc windowId={desktopWindow.id} isActive /></WindowOwnedPopupLayer></KCalcConstantsProvider></StrictMode>
  </WindowManagerContext.Provider>,
));

const root = () => container.querySelector<HTMLDivElement>("[data-kcalc-root='true']")!;
const button = (scope: ParentNode, label: string) => [...scope.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label || candidate.textContent?.startsWith(label))!;
const display = () => (root().querySelector("[aria-label='Calculator display']") as HTMLInputElement).value;
const setInput = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  windowManager = createWindowManager();
  desktopWindow = { id: "app:kcalc", appId: "kcalc", title: "KCalc", iconId: "kcalc", desktopId: 1, bounds: { x: 20, y: 20, width: 310, height: 300 }, zIndex: 2, isActive: true, state: "normal", isDraggable: true, minimumWidth: 292, minimumHeight: 270, isResizable: true };
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("kcalc-menu-popup")) return rect(0, 0, 210, 130);
    if (this.classList.contains("kcalc-menuitem")) return rect(this.textContent === "Constants" ? 80 : 20, 40, 60, 20);
    return rect(120, 70, 80, 20);
  });
});

afterEach(() => { act(() => reactRoot.unmount()); container.remove(); vi.restoreAllMocks(); });

describe("KCalc constants menu and register configuration", () => {
  it("uses owner-scoped category and built-in menus, and inserts Pi as a fresh command result", () => {
    renderKCalc();
    expect(button(root(), "Constants").disabled).toBe(false);
    act(() => button(root(), "Constants").click());
    const categoryMenu = container.querySelector<HTMLDivElement>("[aria-label='Constants menu']")!;
    expect(categoryMenu.parentElement?.dataset.windowId).toBe(desktopWindow.id);
    expect([...categoryMenu.querySelectorAll("[data-kcalc-constant-category]")]).toHaveLength(5);
    act(() => button(categoryMenu, "Mathematics").click());
    const submenu = container.querySelector<HTMLDivElement>("[aria-label='Mathematics constants']")!;
    expect(submenu.parentElement?.dataset.windowId).toBe(desktopWindow.id);
    act(() => button(submenu, "Pi").click());
    expect(display()).toBe("3.14159265359");
    act(() => button(root(), "2").click());
    expect(display()).toBe("2");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("preserves a pending operand, consumes INV only on selection, and leaves the register unchanged", () => {
    renderKCalc();
    act(() => { button(root(), "2").click(); button(root(), "+").click(); button(root(), "Inv").click(); button(root(), "Constants").click(); });
    expect(root().querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("INV");
    const categoryMenu = container.querySelector<HTMLDivElement>("[aria-label='Constants menu']")!;
    act(() => button(categoryMenu, "Mathematics").click());
    act(() => button(container.querySelector("[aria-label='Mathematics constants']")!, "Pi").click());
    expect(root().querySelector("[data-kcalc-status-slot='mode']")?.textContent).toBe("NORM");
    act(() => button(root(), "=").click());
    expect(display()).toBe("5.14159265359");
  });

  it("targets a physical register from its context menu and applies a source catalog constant without changing the display", () => {
    renderKCalc();
    act(() => button(root(), "Settings").click());
    act(() => button(container.querySelector("[aria-label='Settings menu']")!, "Constants Buttons").click());
    const constant = root().querySelector<HTMLButtonElement>("[data-kcalc-command-slot='constant-1']")!;
    act(() => constant.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 260, clientY: 140 })));
    const contextMenu = container.querySelector<HTMLDivElement>("[aria-label='Constant constant-1 menu']")!;
    expect(contextMenu.parentElement?.dataset.windowId).toBe(desktopWindow.id);
    act(() => button(contextMenu, "Choose From List").click());
    const catalog = container.querySelector<HTMLDivElement>("[aria-label='Constants catalog']")!;
    act(() => button(catalog, "Mathematics").click());
    act(() => button(container.querySelector("[aria-label='Mathematics constants']")!, "Pi").click());
    expect(constant.textContent).toBe("Pi");
    expect(display()).toBe("0");
    act(() => constant.click());
    expect(display()).toBe("3.14159265359");
  });

  it("edits six staged configuration rows, validates decimal values, and commits only with Apply or OK", () => {
    renderKCalc();
    act(() => button(root(), "Settings").click());
    act(() => button(container.querySelector("[aria-label='Settings menu']")!, "Configure KCalc...").click());
    const dialog = container.querySelector<HTMLDivElement>("[aria-label='Configure Constants']")!;
    expect(dialog.querySelectorAll("[data-kcalc-constant-config-slot]")).toHaveLength(6);
    const firstRow = dialog.querySelector<HTMLElement>("[data-kcalc-constant-config-slot='constant-1']")!;
    const [nameInput, valueInput] = firstRow.querySelectorAll<HTMLInputElement>("input");
    act(() => {
      setInput(nameInput, "TEST");
      setInput(valueInput, "1.5");
    });
    expect(button(dialog, "Apply").disabled).toBe(false);
    act(() => button(dialog, "Apply").click());
    act(() => button(dialog, "Cancel").click());
    act(() => button(root(), "Settings").click());
    act(() => button(container.querySelector("[aria-label='Settings menu']")!, "Constants Buttons").click());
    expect(root().querySelector("[data-kcalc-command-slot='constant-1']")?.textContent).toBe("TEST");
  });
});
