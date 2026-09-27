// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopSessionContext, type DesktopSessionContextValue } from "../../desktop/desktopSessionContext";
import { WindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupLayer";
import type { DesktopWindow } from "../../window-manager/types";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KCalc } from "./KCalc";

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

const createWindow = (id: string, isActive: boolean): DesktopWindow => ({
  id,
  appId: "kcalc",
  title: id === "app:kcalc" ? "KCalc" : "KCalc<2>",
  iconId: "kcalc",
  desktopId: 1,
  bounds: { x: 30, y: 30, width: 310, height: 300 },
  zIndex: isActive ? 2 : 1,
  isActive,
  state: "normal",
  isDraggable: true,
  minimumWidth: 292,
  minimumHeight: 270,
  isResizable: true,
});

function ClipboardHarness({ children }: { readonly children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const value = useMemo<DesktopSessionContextValue>(() => ({
    isLocked: false,
    endSessionDialog: "closed",
    isClipboardOpen: false,
    clipboardHistory: text === null ? [] : [text],
    currentClipboardText: text,
    hasClipboardText: text !== null && text.length > 0,
    clipboardStatus: null,
    selectionCaptureGeneration: 0,
    resetGeneration: 0,
    lockSession: () => undefined,
    unlockSession: () => undefined,
    openEndSession: () => undefined,
    requestEndSession: () => undefined,
    returnToEndSessionOptions: () => undefined,
    closeEndSession: () => undefined,
    confirmEndSession: () => undefined,
    toggleClipboard: () => undefined,
    closeClipboard: () => undefined,
    recordClipboardText: (nextText) => setText(nextText),
    readClipboardText: () => text,
    writeClipboard: async (nextText) => setText(nextText),
    clearClipboardHistory: () => undefined,
  }), [text]);

  return <DesktopSessionContext.Provider value={value}>{children}</DesktopSessionContext.Provider>;
}

const renderKCalcs = (windows: readonly DesktopWindow[]) => {
  windowManager = createWindowManager(windows);
  act(() => {
    reactRoot.render(
      <WindowManagerContext.Provider value={windowManager}>
        <ClipboardHarness>
          <StrictMode>
            {windows.map((desktopWindow) => (
              <WindowOwnedPopupLayer key={desktopWindow.id} desktopWindow={desktopWindow}>
                <KCalc windowId={desktopWindow.id} isActive={desktopWindow.isActive} focusRequestId={desktopWindow.isActive ? 1 : 0} />
              </WindowOwnedPopupLayer>
            ))}
          </StrictMode>
        </ClipboardHarness>
      </WindowManagerContext.Provider>,
    );
  });
};

const getRoot = (windowId = "app:kcalc"): HTMLDivElement => {
  const root = container.querySelector<HTMLDivElement>(`[data-kcalc-root='true'][data-window-id='${windowId}']`);
  if (!root) throw new Error(`Missing KCalc root ${windowId}`);
  return root;
};

const display = (root: ParentNode): HTMLInputElement => {
  const input = root.querySelector<HTMLInputElement>("[aria-label='Calculator display']");
  if (!input) throw new Error("Missing calculator display");
  return input;
};

const getButton = (scope: ParentNode, label: string): HTMLButtonElement => {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Missing button ${label}`);
  return button;
};

const click = (scope: ParentNode, label: string) => act(() => getButton(scope, label).click());

const clickEditCommand = (root: ParentNode, commandId: string) => act(() => {
  const command = container.querySelector<HTMLButtonElement>(`[data-kcalc-edit-command='${commandId}']`);
  if (!command) throw new Error(`Missing Edit command ${commandId}`);
  command.click();
});

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("kcalc-edit-menu")) return rect(0, 0, 168, 118);
    if (this.classList.contains("kcalc-menu-popup")) return rect(0, 0, 116, 25);
    if (this.classList.contains("kcalc-menuitem") && this.textContent === "Edit") return rect(40, 31, 34, 20);
    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("KCalc shared text clipboard", () => {
  it("renders the KDE3 Edit order with disabled Undo/Redo and state-derived Copy/Paste availability", () => {
    renderKCalcs([createWindow("app:kcalc", true)]);
    const root = getRoot();
    click(root, "Edit");

    const menu = container.querySelector<HTMLElement>("[aria-label='Edit menu']");
    expect(menu?.querySelectorAll("[role='separator']")).toHaveLength(1);
    expect([...menu?.querySelectorAll<HTMLButtonElement>("button") ?? []].map((item) => item.textContent)).toEqual([
      "UndoCtrl+Z", "RedoCtrl+Shift+Z", "CutCtrl+X", "CopyCtrl+C", "PasteCtrl+V",
    ]);
    expect(getButton(menu as HTMLElement, "UndoCtrl+Z").disabled).toBe(true);
    expect(getButton(menu as HTMLElement, "RedoCtrl+Shift+Z").disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>("[data-kcalc-edit-command='edit-copy']")?.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>("[data-kcalc-edit-command='edit-paste']")?.disabled).toBe(true);
  });

  it("copies, cuts, and pastes canonical text between exact KCalc instances without committing a pending operand", () => {
    const first = createWindow("app:kcalc", true);
    const second = createWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);

    click(firstRoot, "2");
    click(firstRoot, "+");
    click(firstRoot, "3");
    click(firstRoot, "Edit");
    clickEditCommand(firstRoot, "edit-cut");
    expect(display(firstRoot).value).toBe("0");
    click(firstRoot, "=");
    expect(display(firstRoot).value).toBe("2");

    click(secondRoot, "Edit");
    clickEditCommand(secondRoot, "edit-paste");
    expect(display(secondRoot).value).toBe("3");
  });

  it("routes Ctrl+C/X/V only through the active KCalc root and leaves editable targets alone", () => {
    const first = createWindow("app:kcalc", true);
    const second = createWindow("app:kcalc::2", false);
    renderKCalcs([first, second]);
    const firstRoot = getRoot(first.id);
    const secondRoot = getRoot(second.id);

    click(firstRoot, "4");
    act(() => firstRoot.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "c", ctrlKey: true })));
    click(firstRoot, "C");
    act(() => firstRoot.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "v", ctrlKey: true })));
    expect(display(firstRoot).value).toBe("4");

    click(secondRoot, "8");
    act(() => secondRoot.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "x", ctrlKey: true })));
    expect(display(secondRoot).value).toBe("8");

    const textArea = document.createElement("textarea");
    firstRoot.append(textArea);
    act(() => textArea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "x", ctrlKey: true })));
    expect(display(firstRoot).value).toBe("4");
  });

  it("uses current Base clipboard syntax without changing window geometry", () => {
    renderKCalcs([createWindow("app:kcalc", true)]);
    const root = getRoot();
    click(root, "Settings");
    const settings = container.querySelector<HTMLElement>("[aria-label='Settings menu']");
    click(settings as HTMLElement, "Logic Buttons");
    vi.mocked(windowManager.resizeWindow).mockClear();
    click(root, "Hex");
    click(root, "A");
    click(root, "F");
    click(root, "Edit");
    clickEditCommand(root, "edit-copy");
    click(root, "C");

    click(root, "Edit");
    clickEditCommand(root, "edit-paste");
    expect(display(root).value).toBe("AF");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("routes a primary display click through the existing Copy command without mutating calculator state", () => {
    renderKCalcs([createWindow("app:kcalc", true)]);
    const root = getRoot();

    click(root, "2");
    click(root, "5");
    act(() => display(root).click());
    click(root, "C");
    click(root, "Edit");
    clickEditCommand(root, "edit-paste");

    expect(display(root).value).toBe("25");
    expect(windowManager.resizeWindow).not.toHaveBeenCalled();
  });

  it("leaves the shared clipboard unchanged when Error makes Copy unavailable", () => {
    renderKCalcs([createWindow("app:kcalc", true)]);
    const root = getRoot();

    click(root, "8");
    act(() => display(root).click());
    click(root, "C");
    click(root, "0");
    click(root, "1/x");
    expect(display(root).value).toBe("Error");
    act(() => display(root).click());
    click(root, "5");
    click(root, "Edit");
    clickEditCommand(root, "edit-paste");

    expect(display(root).value).toBe("8");
  });

  it("enables display-history Undo/Redo dynamically and scopes Ctrl+Z shortcuts to the active calculator root", () => {
    renderKCalcs([createWindow("app:kcalc", true)]);
    const root = getRoot();

    click(root, "2");
    click(root, "+");
    click(root, "3");
    click(root, "=");
    click(root, "Edit");
    expect(container.querySelector<HTMLButtonElement>("[data-kcalc-edit-command='edit-undo']")?.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>("[data-kcalc-edit-command='edit-redo']")?.disabled).toBe(true);

    clickEditCommand(root, "edit-undo");
    expect(display(root).value).toBe("5");
    click(root, "Edit");
    expect(container.querySelector<HTMLButtonElement>("[data-kcalc-edit-command='edit-undo']")?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>("[data-kcalc-edit-command='edit-redo']")?.disabled).toBe(false);

    act(() => root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "z", ctrlKey: true, shiftKey: true })));
    expect(display(root).value).toBe("5");

    const textArea = document.createElement("textarea");
    root.append(textArea);
    act(() => textArea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "z", ctrlKey: true })));
    expect(display(root).value).toBe("5");
    act(() => root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "y", ctrlKey: true })));
    expect(display(root).value).toBe("5");
  });
});
