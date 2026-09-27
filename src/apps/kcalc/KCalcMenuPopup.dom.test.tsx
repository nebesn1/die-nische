// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupLayer";
import type { DesktopWindow } from "../../window-manager/types";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KCalc } from "./KCalc";

let container: HTMLDivElement;
let reactRoot: Root;
let windowManager: WindowManagerContextValue;
let desktopWindow: DesktopWindow;

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

const createWindowManager = (): WindowManagerContextValue => ({
  windows: [],
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

const createDesktopWindow = (id = "app:kcalc"): DesktopWindow => ({
  id,
  appId: "kcalc",
  title: id === "app:kcalc" ? "KCalc" : "KCalc<2>",
  iconId: "kcalc",
  desktopId: 1,
  bounds: { x: 640, y: 40, width: 310, height: 300 },
  zIndex: id === "app:kcalc" ? 2 : 1,
  isActive: id === "app:kcalc",
  state: "normal",
  isDraggable: true,
  minimumWidth: 292,
  minimumHeight: 270,
  isResizable: true,
});

const renderKCalc = (nextDesktopWindow = desktopWindow) => {
  desktopWindow = nextDesktopWindow;
  act(() => {
    reactRoot.render(
      <WindowManagerContext.Provider value={windowManager}>
        <StrictMode>
          <WindowOwnedPopupLayer desktopWindow={desktopWindow}>
            <KCalc windowId={desktopWindow.id} isActive={desktopWindow.isActive} />
          </WindowOwnedPopupLayer>
        </StrictMode>
      </WindowManagerContext.Provider>,
    );
  });
};

const getRoot = (): HTMLDivElement => {
  const root = container.querySelector<HTMLDivElement>(`[data-kcalc-root='true'][data-window-id='${desktopWindow.id}']`);

  if (!root) {
    throw new Error("Missing KCalc root");
  }

  return root;
};

const clickMenu = (label: string) => {
  act(() => {
    [...getRoot().querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === label)?.click();
  });
};

const getPopup = (): HTMLDivElement => {
  const popup = container.querySelector<HTMLDivElement>(".kcalc-menu-popup");

  if (!popup) {
    throw new Error("Missing KCalc menu popup");
  }

  return popup;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  windowManager = createWindowManager();
  desktopWindow = createDesktopWindow();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("kcalc-menu-popup")) {
      return this.classList.contains("kcalc-settings-menu") ? rect(0, 0, 236, 220) : rect(0, 0, 116, 25);
    }

    if (this.classList.contains("kcalc-menuitem")) {
      if (this.textContent === "Settings") {
        return rect(860, 600, 48, 20);
      }

      if (this.textContent === "File") {
        return rect(670, 40, 34, 21);
      }
    }

    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("KCalc window-owned menu popups", () => {
  it("ports Settings into the exact owner layer and clamps its measured wide popup to ScreenArea", () => {
    renderKCalc();
    clickMenu("Settings");
    const popup = getPopup();
    const popupLayer = container.querySelector<HTMLElement>(".window-owned-popup-layer[data-window-id='app:kcalc']");

    expect(popupLayer?.contains(popup)).toBe(true);
    expect(getRoot().contains(popup)).toBe(false);
    expect(popup.dataset.windowId).toBe("app:kcalc");
    expect(popup.dataset.menuRequestId).toBe("1");
    expect(popup.dataset.positioned).toBe("true");
    expect(popup.style.left).toBe("664px");
    expect(popup.style.top).toBe("466px");
    expect(popup.style.visibility).toBe("");
    expect(popup.classList.contains("kcalc-settings-menu")).toBe(true);
  });

  it("creates a fresh geometry request when switching menus and preserves the Settings width contract", () => {
    renderKCalc();
    clickMenu("Settings");
    expect(getPopup().dataset.menuRequestId).toBe("1");
    expect(getPopup().style.left).toBe("664px");

    clickMenu("File");
    const popup = getPopup();
    expect(popup.dataset.menuRequestId).toBe("2");
    expect(popup.style.left).toBe("670px");
    expect(popup.style.top).toBe("60px");

    clickMenu("Settings");
    expect(getPopup().dataset.menuRequestId).toBe("3");
    expect(getPopup().classList.contains("kcalc-settings-menu")).toBe(true);
    expect(getPopup().style.left).toBe("664px");
  });

  it("can extend beyond the owner WindowFrame when ScreenArea has room", () => {
    windowManager = {
      ...windowManager,
      screenArea: { x: 0, y: 0, width: 1200, height: 686 },
    };
    renderKCalc();
    clickMenu("Settings");
    const popup = getPopup();

    expect(Number.parseInt(popup.style.left, 10) + 236).toBeGreaterThan(desktopWindow.bounds.x + desktopWindow.bounds.width);
    expect(popup.parentElement?.dataset.windowId).toBe(desktopWindow.id);
  });

  it("keeps the shared Escape and click-away dismissal contracts after portaling", () => {
    renderKCalc();
    clickMenu("Settings");
    expect(container.querySelector(".kcalc-menu-popup")).not.toBeNull();

    act(() => {
      getRoot().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    expect(container.querySelector(".kcalc-menu-popup")).toBeNull();

    clickMenu("Settings");
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(container.querySelector(".kcalc-menu-popup")).toBeNull();
  });

  it("dismisses a portaled popup when its exact owner becomes minimized", () => {
    renderKCalc();
    clickMenu("Settings");
    expect(container.querySelector(".kcalc-menu-popup")).not.toBeNull();

    renderKCalc({ ...desktopWindow, state: "minimized" });
    expect(container.querySelector(".kcalc-menu-popup")).toBeNull();
    expect(container.querySelector(".window-owned-popup-layer")?.hasAttribute("hidden")).toBe(true);
  });
});
