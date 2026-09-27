import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WindowPopupLayer } from "../../desktop/WindowPopupLayer";
import { WindowManagerContext, type WindowManagerContextValue } from "../useWindowManager";
import type { DesktopWindow, WorkArea } from "../types";
import { WindowMenuContext } from "./WindowMenuContext";
import type { WindowMenuContextValue } from "./types";
import { createWindowMenuEntries } from "./windowMenuModel";
import { WindowMenuPanel } from "./WindowMenuPanel";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};

const desktopWindow: DesktopWindow = {
  id: "app:konqueror",
  appId: "konqueror",
  title: "Conquer your Desktop! - Konqueror",
  iconId: "konqueror",
  desktopId: 2,
  bounds: { x: 80, y: 60, width: 560, height: 420 },
  zIndex: 30,
  isActive: true,
  state: "normal",
  isDraggable: true,
  minimumWidth: 420,
  minimumHeight: 280,
  isResizable: true,
};

const windowManagerContext: WindowManagerContextValue = {
  windows: [desktopWindow],
  currentDesktopId: 2,
  lastActiveWindowIdByDesktop: {
    1: null,
    2: "app:konqueror",
    3: null,
    4: null,
  },
  showDesktopSessionByDesktop: {
    1: null,
    2: null,
    3: null,
    4: null,
  },
  workArea,
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
};

const windowMenuContext: WindowMenuContextValue = {
  state: {
    openWindowId: desktopWindow.id,
    openSubmenuId: "to-desktop",
    activeItemId: "to-desktop",
    anchor: { left: 80, top: 60, right: 96, bottom: 76, width: 16, height: 16 },
  },
  openWindowMenu: vi.fn(),
  toggleWindowMenu: vi.fn(),
  closeWindowMenu: vi.fn(),
  setActiveItem: vi.fn(),
  openSubmenu: vi.fn(),
  closeSubmenu: vi.fn(),
};

const renderPanel = (window = desktopWindow): string =>
  renderToStaticMarkup(
    <WindowManagerContext.Provider value={{ ...windowManagerContext, windows: [window] }}>
      <WindowMenuContext.Provider value={windowMenuContext}>
        <WindowMenuPanel
          desktopWindow={window}
          entries={createWindowMenuEntries(window)}
          menuId="window-menu-app-konqueror"
          position={{ x: 80, y: 77 }}
        />
      </WindowMenuContext.Provider>
    </WindowManagerContext.Provider>,
  );

describe("WindowMenu SSR structure", () => {
  it("renders the root menu with command, disabled, submenu, and separator semantics", () => {
    const markup = renderPanel();

    expect(markup).toContain("role=\"menu\"");
    expect(markup).toContain("Window menu for Conquer your Desktop! - Konqueror");
    expect(markup).toContain("Minimize");
    expect(markup).toContain("Maximize");
    expect(markup).toContain("Close");
    expect(markup).toContain("To Desktop");
    expect(markup).not.toContain("Move to Desktop");
    expect(markup).not.toContain(">Move<");
    expect(markup).not.toContain(">Resize<");
    expect(markup).toContain("aria-haspopup=\"menu\"");
    expect(markup).toContain("role=\"separator\"");
    expect(markup).toContain("style=\"left:80px;top:77px\"");
    expect(markup).not.toContain("transform:translate3d");
  });

  it("keeps Calendar Minimize visible but disabled while Maximize and Close remain available", () => {
    const markup = renderPanel({ ...desktopWindow, appId: "calendar", title: "Calendar", isMinimizable: false });

    expect(markup).toMatch(/aria-disabled="true"[^>]*data-window-menu-item-id="minimize"/);
    expect(markup).toContain("Maximize");
    expect(markup).toContain("Close");
  });

  it("renders four desktop menuitemradio entries and marks the current desktop", () => {
    const markup = renderPanel();

    expect((markup.match(/role="menuitemradio"/g) ?? []).length).toBe(4);
    expect(markup).toContain("Desktop 1");
    expect(markup).toContain("Desktop 4");
    expect(markup).toContain("aria-checked=\"true\"");
  });

  it("renders a window popup layer without interactive menu items when closed", () => {
    const closedContext: WindowMenuContextValue = {
      ...windowMenuContext,
      state: {
        openWindowId: null,
        openSubmenuId: null,
        activeItemId: null,
        anchor: null,
      },
    };
    const markup = renderToStaticMarkup(
      <WindowManagerContext.Provider value={windowManagerContext}>
        <WindowMenuContext.Provider value={closedContext}>
          <WindowPopupLayer />
        </WindowMenuContext.Provider>
      </WindowManagerContext.Provider>,
    );

    expect(markup).toContain("window-popup-layer");
    expect(markup).not.toContain("role=\"menuitem\"");
  });
});
