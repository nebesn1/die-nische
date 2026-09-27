import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { WindowManagerContext, type WindowManagerContextValue } from "./useWindowManager";
import { WindowFrame } from "./WindowFrame";
import type { DesktopWindow, WorkArea } from "./types";
import { WindowMenuContext } from "./window-menu/WindowMenuContext";
import type { WindowMenuContextValue } from "./window-menu/types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 800,
  height: 554,
  titleBarHeight: 22,
};

const baseWindow: DesktopWindow = {
  id: "about",
  appId: "about",
  title: "About die Nische",
  iconId: "about",
  desktopId: 1,
  bounds: {
    x: 120,
    y: 90,
    width: 390,
    height: 230,
  },
  zIndex: 30,
  isActive: true,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
};

const contextValue: WindowManagerContextValue = {
  windows: [baseWindow],
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: {
    1: "about",
    2: null,
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

const windowMenuContextValue: WindowMenuContextValue = {
  state: {
    openWindowId: null,
    openSubmenuId: null,
    activeItemId: null,
    anchor: null,
  },
  openWindowMenu: vi.fn(),
  toggleWindowMenu: vi.fn(),
  closeWindowMenu: vi.fn(),
  setActiveItem: vi.fn(),
  openSubmenu: vi.fn(),
  closeSubmenu: vi.fn(),
};

const renderFrame = (desktopWindow: DesktopWindow, context: WindowManagerContextValue = contextValue): string =>
  renderToStaticMarkup(
    <WindowManagerContext.Provider value={context}>
      <WindowMenuContext.Provider value={windowMenuContextValue}>
        <WindowFrame desktopWindow={desktopWindow} icon={<span />} className="about-window">
          <p>Window content</p>
        </WindowFrame>
      </WindowMenuContext.Provider>
    </WindowManagerContext.Provider>,
  );

const getRootSectionTag = (markup: string): string => {
  const match = markup.match(/^<section\b[^>]*>/);

  if (!match) {
    throw new Error("WindowFrame root section was not rendered");
  }

  return match[0];
};

describe("WindowFrame minimized visibility attributes", () => {
  it("does not mark a normal window as hidden or minimized", () => {
    const rootTag = getRootSectionTag(renderFrame(baseWindow));

    expect(rootTag).not.toContain("hidden=\"\"");
    expect(rootTag).not.toContain("is-minimized");
    expect(rootTag).not.toContain("is-off-desktop");
    expect(rootTag).toContain("data-show-desktop-hidden=\"false\"");
    expect(rootTag).toContain("data-desktop-id=\"1\"");
    expect(rootTag).toContain("data-current-desktop=\"true\"");
    expect(rootTag).toContain("data-window-state=\"normal\"");
  });

  it("marks a minimized window with hidden semantics and minimized class", () => {
    const rootTag = getRootSectionTag(
      renderFrame({
        ...baseWindow,
        isActive: false,
        state: "minimized",
      }),
    );

    expect(rootTag).toContain("hidden=\"\"");
    expect(rootTag).toContain("aria-hidden=\"true\"");
    expect(rootTag).toContain("is-minimized");
    expect(rootTag).toContain("data-window-state=\"minimized\"");
  });

  it("marks an off-desktop window as hidden without unrendering its structure", () => {
    const markup = renderFrame({
      ...baseWindow,
      desktopId: 2,
      isActive: false,
    });
    const rootTag = getRootSectionTag(markup);

    expect(rootTag).toContain("hidden=\"\"");
    expect(rootTag).toContain("aria-hidden=\"true\"");
    expect(rootTag).toContain("is-off-desktop");
    expect(rootTag).toContain("data-desktop-id=\"2\"");
    expect(rootTag).toContain("data-current-desktop=\"false\"");
    expect(markup).toContain("Window content");
  });

  it("does not render resize handles for an off-desktop window", () => {
    const markup = renderFrame({
      ...baseWindow,
      desktopId: 2,
      isActive: false,
    });

    expect(markup).not.toContain("data-resize-direction=");
  });

  it("marks a show-desktop-hidden window as hidden without unrendering its structure", () => {
    const markup = renderFrame(
      {
        ...baseWindow,
        isActive: false,
      },
      {
        ...contextValue,
        showDesktopSessionByDesktop: {
          ...contextValue.showDesktopSessionByDesktop,
          1: {
            windowIds: ["about"],
            previouslyActiveWindowId: "about",
          },
        },
      },
    );
    const rootTag = getRootSectionTag(markup);

    expect(rootTag).toContain("hidden=\"\"");
    expect(rootTag).toContain("aria-hidden=\"true\"");
    expect(rootTag).toContain("is-show-desktop-hidden");
    expect(rootTag).toContain("data-show-desktop-hidden=\"true\"");
    expect(markup).toContain("Window content");
  });

  it("can express off-desktop and show-desktop-hidden reasons together", () => {
    const rootTag = getRootSectionTag(
      renderFrame(
        {
          ...baseWindow,
          desktopId: 2,
          isActive: false,
        },
        {
          ...contextValue,
          showDesktopSessionByDesktop: {
            ...contextValue.showDesktopSessionByDesktop,
            2: {
              windowIds: ["about"],
              previouslyActiveWindowId: "about",
            },
          },
        },
      ),
    );

    expect(rootTag).toContain("is-off-desktop");
    expect(rootTag).toContain("is-show-desktop-hidden");
    expect(rootTag).toContain("data-current-desktop=\"false\"");
    expect(rootTag).toContain("data-show-desktop-hidden=\"true\"");
  });

  it("removes hidden state after restoring to normal", () => {
    const rootTag = getRootSectionTag(
      renderFrame({
        ...baseWindow,
        state: "normal",
      }),
    );

    expect(rootTag).not.toContain("hidden=\"\"");
    expect(rootTag).not.toContain("aria-hidden=\"true\"");
    expect(rootTag).not.toContain("is-minimized");
  });

  it("marks a maximized window with maximized state attributes", () => {
    const rootTag = getRootSectionTag(
      renderFrame({
        ...baseWindow,
        state: "maximized",
      }),
    );

    expect(rootTag).toContain("is-maximized");
    expect(rootTag).toContain("data-window-state=\"maximized\"");
    expect(rootTag).not.toContain("hidden=\"\"");
  });

  it("presents a normal mobile window as maximized without changing its persisted state", () => {
    const markup = renderFrame(baseWindow, {
      ...contextValue,
      layoutMode: "mobile",
    });
    const rootTag = getRootSectionTag(markup);

    expect(rootTag).toContain("is-maximized");
    expect(rootTag).toContain("data-window-state=\"normal\"");
    expect(markup).toMatch(/data-window-action="maximize"[^>]*disabled=""/);
    expect(markup).not.toContain("data-resize-direction=");
  });

  it("presents Calendar as a compact mobile window while retaining the mobile caption policy", () => {
    const markup = renderFrame({
      ...baseWindow,
      id: "app:calendar",
      appId: "calendar",
      title: "Calendar",
      isMinimizable: false,
      alwaysOnTop: true,
    }, {
      ...contextValue,
      layoutMode: "mobile",
    });

    expect(markup).not.toContain("is-maximized");
    expect(markup).toMatch(/data-window-action="maximize"[^>]*disabled=""/);
    expect(markup).toMatch(/data-window-action="close"(?![^>]*disabled="")/);
    expect(markup).not.toContain("data-resize-direction=");
  });

  it("uses Maximize, Restore, and Close button labels with the window title", () => {
    const normalMarkup = renderFrame(baseWindow);
    const maximizedMarkup = renderFrame({
      ...baseWindow,
      state: "maximized",
    });

    expect(normalMarkup).toContain("aria-label=\"Maximize About die Nische\"");
    expect(normalMarkup).toContain("aria-label=\"Close About die Nische\"");
    expect(maximizedMarkup).toContain("aria-label=\"Restore About die Nische\"");
  });

  it("keeps caption glyphs semantic and capability-owned while exposing the KDE Classic minimize variant", () => {
    const markup = renderFrame(baseWindow);

    expect(markup).toContain('class="window-controls"');
    expect(markup).toContain('class="window-control window-control--minimize"');
    expect(markup).toContain('class="window-control__minimize-line"');
    expect(markup).toContain('class="window-control__minimize-square"');
    expect(markup).toContain('class="window-control window-control--maximize"');
    expect(markup).toContain('class="window-control window-control--close"');
    expect(markup).toContain('data-window-action="minimize"');
    expect(markup).toContain('data-window-action="maximize"');
    expect(markup).toContain('data-window-action="close"');
  });

  it("keeps KDE Classic and Redmond restore glyph variants in the same capability-owned button", () => {
    const markup = renderFrame({ ...baseWindow, state: "maximized" });
    const kdeRestore = markup.slice(markup.indexOf('class="window-control__restore-kde"'), markup.indexOf('class="window-control__restore-redmond"'));

    expect(markup).toContain('class="window-control__restore-kde"');
    expect(markup).toContain('class="window-control__restore-redmond"');
    expect(kdeRestore).toContain('x="1.5" y="1.5" width="6" height="6"');
    expect(kdeRestore).toContain('x="4.5" y="4.5" width="6" height="6"');
    expect(kdeRestore).not.toContain('x="3.5" y="1.5" width="6" height="6"');
    expect(kdeRestore).not.toContain('x="1.5" y="3.5" width="6" height="6"');
    expect(markup).toContain('data-window-action="maximize"');
    expect(markup).toContain('aria-label="Restore About die Nische"');
  });

  it("omits the minimize control for a non-minimizable window while preserving maximize and close", () => {
    const markup = renderFrame({ ...baseWindow, isMinimizable: false, title: "Calendar" });

    expect(markup).not.toContain('data-window-action="minimize"');
    expect(markup).toContain('data-window-action="maximize"');
    expect(markup).toContain('data-window-action="close"');
  });

  it("keeps Close enabled while disabling Minimize and Maximize on a visible mobile caption", () => {
    const markup = renderFrame(baseWindow, { ...contextValue, layoutMode: "mobile" });

    expect(markup).toMatch(/data-window-action="minimize"[^>]*disabled=""/);
    expect(markup).toMatch(/data-window-action="maximize"[^>]*disabled=""/);
    expect(markup).toMatch(/data-window-action="close"(?![^>]*disabled="")/);
  });

  it("keeps a non-maximizable window's maximize control visible and disabled without removing resize handles", () => {
    const markup = renderFrame({ ...baseWindow, isMaximizable: false });

    expect(markup).toContain('data-window-action="maximize"');
    expect(markup).toMatch(/data-window-action="maximize"[^>]*disabled=""/);
    expect(markup).toContain('data-resize-direction="se"');
  });

  it("renders the titlebar application icon as a window menu button", () => {
    const markup = renderFrame(baseWindow);

    expect(markup).toContain("window-titlebar__icon-button");
    expect(markup).toContain("type=\"button\"");
    expect(markup).toContain("aria-label=\"Open window menu for About die Nische\"");
    expect(markup).toContain("aria-expanded=\"false\"");
    expect(markup).toContain("data-window-menu-button=\"true\"");
  });

  it("renders eight resize handles for a normal resizable window", () => {
    const markup = renderFrame(baseWindow);
    const directions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

    directions.forEach((direction) => {
      expect(markup).toContain(`data-resize-direction="${direction}"`);
    });
  });

  it("does not render resize handles for a maximized window", () => {
    const markup = renderFrame({
      ...baseWindow,
      state: "maximized",
    });

    expect(markup).not.toContain("data-resize-direction=");
  });

  it("does not render resize handles for a non-resizable window", () => {
    const markup = renderFrame({
      ...baseWindow,
      isResizable: false,
    });

    expect(markup).not.toContain("data-resize-direction=");
  });

  it("renders the managed outer frame with edge-anchored logical geometry", () => {
    const markup = renderFrame(baseWindow);

    expect(markup).toContain("style=\"left:120px;top:90px;right:290px;bottom:234px;z-index:30\"");
    expect(markup).not.toContain("translate3d(");
  });

  it("keeps titlebar drag pointer-captured and independent from resize and maximize capability", () => {
    const source = readFileSync(new URL("./WindowFrame.tsx", import.meta.url), "utf8");
    const resizeSource = readFileSync(new URL("./ResizeHandles.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../theme/kde3.css", import.meta.url), "utf8");

    expect(source).toContain("event.currentTarget.setPointerCapture(event.pointerId)");
    expect(source).toContain("titlebarElement.releasePointerCapture(dragSession.pointerId)");
    expect(source).toContain("onPointerCancel={cancelDrag}");
    expect(source).toContain("onLostPointerCapture={cancelDrag}");
    expect(source).toContain("onResizePointerCancel={cancelResize}");
    expect(resizeSource).toContain("onLostPointerCapture={onResizePointerCancel}");
    expect(source).toContain("resizeNormalWindowBounds({");
    expect(source).toContain("screenArea: screenArea ?? {");
    expect(source).toContain("if ((event.target as Element).closest(\"[data-window-control]\"))");
    expect(source).toContain("if (!canToggleMaximize || (event.target as Element).closest(\"[data-window-control]\"))");
    expect(source).toContain("isMaximizable={canToggleMaximize}");
    expect(source).not.toContain("document.addEventListener(\"pointermove\"");
    expect(css).toContain("touch-action: none;");
    expect(css).toContain(".window-control {\n  position: relative;");
    expect(css).toContain(".window-control--close::before");
    expect(css).toMatch(/\.window-frame\s*\{[\s\S]*?box-sizing:\s*border-box;/);
    expect(css).toContain("@media (pointer: coarse)");
  });
});
