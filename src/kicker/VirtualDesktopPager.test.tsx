import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import type { DesktopId, WorkArea } from "../window-manager/types";
import { getPagerKeyboardTarget } from "./pagerNavigation";
import { VirtualDesktopPager } from "./VirtualDesktopPager";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};

const renderPager = (currentDesktopId: DesktopId, desktopCount = 4): string => {
  const context: WindowManagerContextValue = {
    windows: [],
    currentDesktopId,
    desktopCount,
    lastActiveWindowIdByDesktop: {
      1: null,
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

  return renderToStaticMarkup(
    <WindowManagerContext.Provider value={context}>
      <VirtualDesktopPager />
    </WindowManagerContext.Provider>,
  );
};

describe("VirtualDesktopPager", () => {
  it("renders the configured desktop buttons with labels", () => {
    const markup = renderPager(1, 5);

    expect(markup.match(/<button/g)).toHaveLength(5);
    [1, 2, 3, 4, 5].forEach((desktop) => {
      expect(markup).toContain(`aria-label="Switch to desktop ${desktop}"`);
      expect(markup).toContain(`title="Desktop ${desktop}"`);
    });
  });

  it("marks only the current desktop as pressed", () => {
    const markup = renderPager(3, 5);

    expect(markup).toContain('id="pager-desktop-3"');
    expect(markup).toContain('class="pager__cell is-current"');
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(4);
  });

  it("uses one full-height cell for a single desktop", () => {
    const markup = renderPager(1, 1);

    expect(markup).toContain('class="pager pager--single"');
    expect(markup).toContain('class="pager__cell is-current"');
    expect(markup.match(/<button/g)).toHaveLength(1);
  });
});

describe("getPagerKeyboardTarget", () => {
  it("maps arrow keys through the derived row-major grid", () => {
    expect(getPagerKeyboardTarget(1, "ArrowDown", 5)).toBe(4);
    expect(getPagerKeyboardTarget(3, "ArrowDown", 5)).toBeNull();
    expect(getPagerKeyboardTarget(4, "ArrowUp", 5)).toBe(1);
    expect(getPagerKeyboardTarget(5, "ArrowLeft", 5)).toBe(4);
  });

  it("maps Home and End to the first and final desktop", () => {
    expect(getPagerKeyboardTarget(3, "Home", 7)).toBe(1);
    expect(getPagerKeyboardTarget(2, "End", 7)).toBe(7);
  });

  it("returns null for unsupported keys", () => {
    expect(getPagerKeyboardTarget(1, "PageDown")).toBeNull();
  });
});
