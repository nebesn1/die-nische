// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationLauncherContext } from "../application-runtime/useApplicationLauncher";
import type { LaunchApplicationResult } from "../application-runtime/types";
import { DesktopPreferencesProvider } from "../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../preferences/desktopPreferences";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import type { DesktopWindow, WorkArea } from "../window-manager/types";
import { Taskbar } from "./Taskbar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const workArea: WorkArea = { x: 0, y: 0, width: 900, height: 850, titleBarHeight: 22 };
let container: HTMLDivElement;
let reactRoot: Root;
let launchUserApplication: ReturnType<typeof vi.fn>;

const makeWindow = (id: string): DesktopWindow => ({
  id,
  appId: "konqueror",
  title: "Documents - Konqueror",
  iconId: "konqueror",
  desktopId: 1,
  bounds: { x: 20, y: 20, width: 320, height: 220 },
  zIndex: 20,
  isActive: true,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
});

const makeWindowManagerContext = (windows: readonly DesktopWindow[] = []): WindowManagerContextValue => ({
  windows,
  currentDesktopId: 1,
  desktopCount: 4,
  lastActiveWindowIdByDesktop: { 1: windows[0]?.id ?? null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea,
  screenArea: { x: 0, y: 0, width: 900, height: 900 },
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

const renderTaskbar = (windows: readonly DesktopWindow[] = []) => {
  launchUserApplication = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <DesktopPreferencesProvider initialPreferences={DEFAULT_DESKTOP_PREFERENCES}>
        <WindowManagerContext.Provider value={makeWindowManagerContext(windows)}>
          <ApplicationLauncherContext.Provider value={{
            launchApplication: launchUserApplication,
            launchNewApplicationInstance: launchUserApplication,
            launchUserApplication,
          }}>
            <Taskbar />
          </ApplicationLauncherContext.Provider>
        </WindowManagerContext.Provider>
      </DesktopPreferencesProvider>,
    );
  });
};

const openOn = (element: Element, clientX = 820) => {
  act(() => {
    element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX, clientY: 680 }));
  });
};

const rightClickOn = (element: Element, clientX: number) => {
  act(() => {
    element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX, clientY: 680 }));
  });
};

const menuPanel = (): HTMLElement => {
  const panel = container.querySelector<HTMLElement>('[aria-label="Taskbar context menu"]');
  if (!panel) throw new Error("Taskbar context menu missing");
  return panel;
};

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

const mockHelpSubmenuGeometry = (helpRowTop: number, submenuHeight: number) => vi.spyOn(
  HTMLElement.prototype,
  "getBoundingClientRect",
).mockImplementation(function(this: HTMLElement) {
  if (this.matches(".taskbar-context-menu-panel")) {
    return makeRect(0, 0, 220, 84);
  }

  if (this.matches("[data-menu-item-id=taskbar-help]")) {
    return makeRect(0, helpRowTop, 220, 22);
  }

  if (this.matches("[data-k-menu-submenu-id=taskbar-help]")) {
    return makeRect(0, 0, 220, submenuHeight);
  }

  return makeRect(0, 0, 0, 0);
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Taskbar background context menu", () => {
  it("opens only from empty taskbar space and exposes the exact menu", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    openOn(taskbar);

    expect(container.querySelector('[aria-label="Taskbar context menu"]')).not.toBeNull();
    expect([...container.querySelectorAll("[aria-label=\"Taskbar context menu\"] [role=\"menuitem\"]")].map((item) => item.textContent)).toEqual([
      "Configure Panel...",
      "Help",
    ]);
    expect(container.querySelectorAll('[aria-label="Taskbar context menu"] [role="separator"]').length).toBe(1);
  });

  it("opens without selecting a row and uses the desktop context-menu presentation", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    openOn(taskbar);

    expect(menuPanel().querySelectorAll(".k-menu-item.is-active")).toHaveLength(0);
    expect(menuPanel().querySelector('[data-menu-item-id="taskbar-configure-panel"]')?.getAttribute("tabindex")).toBe("-1");
    expect(container.querySelector(".taskbar-context-menu-popup")?.classList.contains("k-menu-popup--context")).toBe(true);
    expect(menuPanel().querySelector("[role=separator]")?.classList.contains("k-context-menu-separator")).toBe(true);
  });

  it("starts keyboard navigation from no selection and leaves Help children unselected", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");
    openOn(taskbar);

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })));
    expect(launchUserApplication).not.toHaveBeenCalled();
    expect(container.querySelector("[data-k-menu-submenu-id=taskbar-help]")).toBeNull();

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" })));
    expect(container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-help"]')?.classList.contains("is-active")).toBe(true);

    openOn(taskbar);
    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-configure-panel"]')?.classList.contains("is-active")).toBe(true);

    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-help"]')?.click());
    expect(container.querySelectorAll('[data-k-menu-submenu-id="taskbar-help"] .k-menu-item.is-active')).toHaveLength(0);

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-about-kde-panel"]')?.classList.contains("is-active")).toBe(true);
  });

  it("opens from the far-right empty task-area filler", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>('[data-kicker-task-area="true"]');
    if (!taskbar) throw new Error("Task area missing");

    openOn(taskbar, 895);

    expect(container.querySelector('[aria-label="Taskbar context menu"]')).not.toBeNull();
  });

  it("dismisses when the same empty taskbar background is left-clicked", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    openOn(taskbar);
    act(() => taskbar.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(container.querySelector('[aria-label="Taskbar context menu"]')).toBeNull();
    expect(launchUserApplication).not.toHaveBeenCalled();
  });

  it("dismisses from the far-right empty task-area hit target", () => {
    renderTaskbar();
    const taskArea = container.querySelector<HTMLElement>('[data-kicker-task-area="true"]');
    if (!taskArea) throw new Error("Task area missing");

    openOn(taskArea, 895);
    act(() => taskArea.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(container.querySelector('[aria-label="Taskbar context menu"]')).toBeNull();
  });

  it("keeps one menu instance and repositions it for a second empty-area right click", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    rightClickOn(taskbar, 820);
    const firstPopup = container.querySelector<HTMLElement>(".taskbar-context-menu-popup");
    if (!firstPopup) throw new Error("Taskbar context menu missing after first right click");
    const firstLeft = firstPopup.style.left;

    rightClickOn(taskbar, 620);
    expect(container.querySelectorAll(".taskbar-context-menu-popup")).toHaveLength(1);
    expect(container.querySelector<HTMLElement>(".taskbar-context-menu-popup")?.style.left).not.toBe(firstLeft);
  });

  it("dismisses the parent and Help submenu from the empty taskbar background", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    openOn(taskbar);
    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-help"]')?.click());
    expect(container.querySelector('[data-k-menu-submenu-id="taskbar-help"]')).not.toBeNull();

    act(() => taskbar.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(container.querySelector('[aria-label="Taskbar context menu"]')).toBeNull();
    expect(container.querySelector('[data-k-menu-submenu-id="taskbar-help"]')).toBeNull();
  });

  it("allows the Help submenu to overlap the Kicker instead of clamping to work-area bottom", () => {
    const geometry = mockHelpSubmenuGeometry(820, 55);
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    openOn(taskbar);
    act(() => container.querySelector<HTMLButtonElement>("[data-menu-item-id=taskbar-help]")?.click());

    expect(container.querySelector<HTMLElement>("[data-k-menu-submenu-id=taskbar-help]")?.style.top).toBe("820px");
    geometry.mockRestore();
  });

  it("clamps the Help submenu only when it exceeds the full viewport", () => {
    const geometry = mockHelpSubmenuGeometry(870, 55);
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");

    openOn(taskbar);
    act(() => container.querySelector<HTMLButtonElement>("[data-menu-item-id=taskbar-help]")?.click());

    expect(container.querySelector<HTMLElement>("[data-k-menu-submenu-id=taskbar-help]")?.style.top).toBe("845px");
    geometry.mockRestore();
  });

  it("does not open from an actual task button", () => {
    renderTaskbar([makeWindow("task-1")]);
    const taskButton = container.querySelector<HTMLButtonElement>(".task-button");
    if (!taskButton) throw new Error("Task button missing");

    openOn(taskButton);

    expect(container.querySelector('[aria-label="Taskbar context menu"]')).toBeNull();
  });

  it("routes Configure Panel through the user-origin launcher", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");
    openOn(taskbar);

    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-configure-panel"]')?.click());

    expect(launchUserApplication).toHaveBeenCalledWith("configure-panel", undefined);
    expect(container.querySelector('[aria-label="Taskbar context menu"]')).toBeNull();
  });

  it("opens the Help submenu in the required order and routes both About applications", () => {
    renderTaskbar();
    const taskbar = container.querySelector<HTMLElement>(".taskbar");
    if (!taskbar) throw new Error("Taskbar missing");
    openOn(taskbar);

    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-help"]')?.click());
    expect([...container.querySelectorAll('[data-k-menu-submenu-id="taskbar-help"] [role="menuitem"]')].map((item) => item.textContent)).toEqual([
      "About KDE Panel",
      "About KDE",
    ]);

    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-about-kde-panel"]')?.click());
    expect(launchUserApplication).toHaveBeenCalledWith("about-kde-panel", undefined);

    openOn(taskbar);
    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-help"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-menu-item-id="taskbar-about-kde"]')?.click());
    expect(launchUserApplication).toHaveBeenCalledWith("about-kde", undefined);
  });
});
