// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowFrame } from "../WindowFrame";
import { WindowManagerContext, type WindowManagerContextValue } from "../useWindowManager";
import type { DesktopWindow, WorkArea } from "../types";
import { WindowMenu } from "./WindowMenu";
import { WindowMenuProvider } from "./WindowMenuProvider";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const workArea: WorkArea = { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 };

const baseWindow: DesktopWindow = {
  id: "app:konqueror",
  appId: "konqueror",
  title: "Konqueror",
  iconId: "konqueror",
  desktopId: 1,
  bounds: { x: 80, y: 60, width: 560, height: 420 },
  zIndex: 30,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 420,
  minimumHeight: 280,
  isResizable: true,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let activateWindow: ReturnType<typeof vi.fn>;

const renderSystemMenu = (desktopWindow: DesktopWindow = baseWindow) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  activateWindow = vi.fn();
  const context: WindowManagerContextValue = {
    windows: [desktopWindow],
    currentDesktopId: 1,
    desktopCount: 5,
    lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null, 5: null },
    showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null, 5: null },
    workArea,
    screenArea: { x: 0, y: 0, width: 900, height: 686 },
    activateWindow,
    focusWindow: vi.fn(),
    openWindow: vi.fn(),
    moveWindow: vi.fn(),
    resizeWindow: vi.fn(),
    fitWindowToContent: vi.fn(),
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
  };

  act(() => {
    root?.render(
      <WindowManagerContext.Provider value={context}>
        <WindowMenuProvider>
          <WindowFrame desktopWindow={desktopWindow} icon={<span>Icon</span>}>
            <div>Content</div>
          </WindowFrame>
          <WindowMenu />
        </WindowMenuProvider>
      </WindowManagerContext.Provider>,
    );
  });
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const getTitlebar = (): HTMLElement => {
  const titlebar = container?.querySelector<HTMLElement>(".window-titlebar");
  if (!titlebar) throw new Error("Missing titlebar");
  return titlebar;
};

const getMenu = (): HTMLElement | null => container?.querySelector<HTMLElement>("[data-window-menu]") ?? null;

const makeRect = (left: number, top: number, width: number, height: number): DOMRect => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  top,
  width,
  x: left,
  y: top,
  toJSON: () => ({}),
} as DOMRect);

const mockMenuGeometry = () => vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
  if (this.matches("[data-window-menu-button]")) {
    return makeRect(100, 60, 16, 16);
  }

  if (this.matches("[data-window-menu-item-id=to-desktop]")) {
    return makeRect(100, 120, 240, 22);
  }

  if (this.matches("[data-window-menu-submenu-id=to-desktop]")) {
    return makeRect(0, 0, 180, 88);
  }

  return makeRect(0, 0, 0, 0);
});

const openToDesktopFromVisibleMenu = () => {
  const toDesktop = container?.querySelector<HTMLButtonElement>("[data-window-menu-item-id=to-desktop]");
  if (!toDesktop) throw new Error("Missing To Desktop menu item");
  act(() => toDesktop.click());
};

describe("Unified Window System Menu DOM", () => {
  it("opens the exact shared menu from the application icon", () => {
    renderSystemMenu();

    act(() => container?.querySelector<HTMLButtonElement>("[data-window-menu-button]")?.click());

    const menu = getMenu();
    expect(menu).not.toBeNull();
    expect([...menu!.querySelectorAll(".window-menu-list > *")].map((item) => {
      const separator = item.matches("[role=separator]") ? item : item.querySelector("[role=separator]");
      return separator ? "separator" : item.querySelector(".window-menu-item__label")?.textContent;
    })).toEqual(["To Desktop", "separator", "Minimize", "Maximize", "separator", "Close"]);
    expect(menu?.textContent).not.toContain("Move to Desktop");
    expect(menu?.textContent).not.toContain("Resize");
  });

  it("opens the same menu from titlebar right-click, prevents the browser menu, and activates the target", () => {
    renderSystemMenu();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 700,
      clientY: 90,
    });

    act(() => getTitlebar().dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(activateWindow).toHaveBeenCalledWith("app:konqueror");
    expect(getMenu()?.getAttribute("aria-label")).toBe("Window menu for Konqueror");
  });

  it("anchors the icon-click To Desktop submenu to the parent menu row", () => {
    const geometry = mockMenuGeometry();
    renderSystemMenu();

    act(() => container?.querySelector<HTMLButtonElement>("[data-window-menu-button]")?.click());
    openToDesktopFromVisibleMenu();

    const submenu = container?.querySelector<HTMLElement>("[data-window-menu-submenu-id=to-desktop]");
    expect(submenu?.style.left).toBe("339px");
    expect(submenu?.style.top).toBe("120px");
    geometry.mockRestore();
  });

  it("anchors the titlebar-right-click To Desktop submenu to the same parent row", () => {
    const geometry = mockMenuGeometry();
    renderSystemMenu();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 700,
      clientY: 90,
    });

    act(() => getTitlebar().dispatchEvent(event));
    openToDesktopFromVisibleMenu();

    const submenu = container?.querySelector<HTMLElement>("[data-window-menu-submenu-id=to-desktop]");
    expect(submenu?.style.left).toBe("339px");
    expect(submenu?.style.top).toBe("120px");
    geometry.mockRestore();
  });

  it("suppresses context menus on titlebar controls without opening a second menu", () => {
    renderSystemMenu();
    const maximize = container?.querySelector<HTMLButtonElement>("[data-window-action='maximize']");
    if (!maximize) throw new Error("Missing maximize control");
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    act(() => maximize.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(getMenu()).toBeNull();
  });

  it("closes from outside pointerdown and Escape", () => {
    renderSystemMenu();
    act(() => container?.querySelector<HTMLButtonElement>("[data-window-menu-button]")?.click());
    expect(getMenu()).not.toBeNull();

    act(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    expect(getMenu()).toBeNull();

    act(() => container?.querySelector<HTMLButtonElement>("[data-window-menu-button]")?.click());
    const activeMenuItem = container?.querySelector<HTMLButtonElement>("[data-window-menu-item-id]");
    act(() => activeMenuItem?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(getMenu()).toBeNull();
  });
});
